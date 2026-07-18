import { Effect, Encoding } from "effect"

import { Ed25519PrivateKey, sign } from "../Crypto/Ed25519PrivateKey.ts"
import { addressFromPublicKey, addressToBytes, type Address } from "./SvmAddress.ts"
import { SvmProtocolError } from "./SvmError.ts"
import { AccountRole, type Instruction, type TransactionMessage } from "./TransactionMessage.ts"

export interface Transaction {
  readonly messageBytes: Uint8Array
  readonly signatures: Readonly<Record<Address, Uint8Array | null>>
  readonly lifetimeConstraint: NonNullable<TransactionMessage["lifetimeConstraint"]>
}

interface OrderedAccount {
  readonly address: Address
  readonly role: AccountRole
  readonly feePayer: boolean
}

const isSigner = (role: AccountRole) => (role & AccountRole.READONLY_SIGNER) !== 0
const isWritable = (role: AccountRole) => (role & AccountRole.WRITABLE) !== 0

const ADDRESS_COMPARATOR = new Intl.Collator("en", {
  caseFirst: "lower",
  ignorePunctuation: false,
  localeMatcher: "best fit",
  numeric: false,
  sensitivity: "variant",
  usage: "sort",
}).compare

const concat = (...parts: ReadonlyArray<Uint8Array>): Uint8Array => {
  const output = new Uint8Array(parts.reduce((length, part) => length + part.length, 0))
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

const encodeShortU16 = (value: number): Uint8Array => {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new SvmProtocolError({ message: "Expected a short u16" })
  }
  const bytes: number[] = []
  let remaining = value
  do {
    let byte = remaining & 0x7f
    remaining >>>= 7
    if (remaining > 0) byte |= 0x80
    bytes.push(byte)
  } while (remaining > 0)
  return Uint8Array.from(bytes)
}

const getOrderedAccounts = (
  feePayer: Address,
  instructions: ReadonlyArray<Instruction>,
): OrderedAccount[] => {
  const accounts = new Map<Address, OrderedAccount>([
    [feePayer, { address: feePayer, role: AccountRole.WRITABLE_SIGNER, feePayer: true }],
  ])
  const invokedPrograms = new Set<Address>()

  const upsert = (accountAddress: Address, role: AccountRole) => {
    const existing = accounts.get(accountAddress)
    if (existing?.feePayer) return
    const mergedRole = existing === undefined ? role : existing.role | role
    if (invokedPrograms.has(accountAddress) && isWritable(mergedRole)) {
      throw new SvmProtocolError({
        message: `Invoked program cannot be writable: ${accountAddress}`,
      })
    }
    accounts.set(accountAddress, { address: accountAddress, role: mergedRole, feePayer: false })
  }

  for (const instruction of instructions) {
    invokedPrograms.add(instruction.programAddress)
    const existingProgram = accounts.get(instruction.programAddress)
    if (existingProgram?.feePayer) {
      throw new SvmProtocolError({ message: "An invoked program cannot pay transaction fees" })
    }
    if (existingProgram !== undefined && isWritable(existingProgram.role)) {
      throw new SvmProtocolError({
        message: `Invoked program cannot be writable: ${instruction.programAddress}`,
      })
    }
    upsert(instruction.programAddress, AccountRole.READONLY)
    for (const account of instruction.accounts ?? []) upsert(account.address, account.role)
  }

  return [...accounts.values()].sort((left, right) => {
    if (left.feePayer !== right.feePayer) return left.feePayer ? -1 : 1
    if (isSigner(left.role) !== isSigner(right.role)) return isSigner(left.role) ? -1 : 1
    if (isWritable(left.role) !== isWritable(right.role)) return isWritable(left.role) ? -1 : 1
    return ADDRESS_COMPARATOR(left.address, right.address)
  })
}

const encodeCompiledInstruction = (
  instruction: Instruction,
  accountIndex: ReadonlyMap<Address, number>,
): Uint8Array => {
  const programIndex = accountIndex.get(instruction.programAddress)
  if (programIndex === undefined) {
    throw new SvmProtocolError({
      message: `Missing program account: ${instruction.programAddress}`,
    })
  }
  const accountIndices = Uint8Array.from(
    (instruction.accounts ?? []).map((account) => {
      const index = accountIndex.get(account.address)
      if (index === undefined) {
        throw new SvmProtocolError({ message: `Missing instruction account: ${account.address}` })
      }
      return index
    }),
  )
  const data = instruction.data ?? new Uint8Array()
  return concat(
    Uint8Array.of(programIndex),
    encodeShortU16(accountIndices.length),
    accountIndices,
    encodeShortU16(data.length),
    data,
  )
}

export const compileTransaction = (message: TransactionMessage): Transaction => {
  if (message.feePayer === undefined)
    throw new SvmProtocolError({ message: "Transaction message has no fee payer" })
  if (message.lifetimeConstraint === undefined) {
    throw new SvmProtocolError({ message: "Transaction message has no blockhash lifetime" })
  }
  if (message.instructions.length > 64) {
    throw new SvmProtocolError({ message: "A transaction supports at most 64 instructions" })
  }
  for (const [index, instruction] of message.instructions.entries()) {
    if ((instruction.accounts?.length ?? 0) > 255) {
      throw new SvmProtocolError({ message: `Instruction ${index} has too many accounts` })
    }
  }

  const accounts = getOrderedAccounts(message.feePayer, message.instructions)
  if (accounts.length > 64)
    throw new SvmProtocolError({ message: "A transaction supports at most 64 accounts" })
  const signerAccounts = accounts.filter((account) => isSigner(account.role))
  if (signerAccounts.length > 12) {
    throw new SvmProtocolError({ message: "A transaction supports at most 12 signers" })
  }

  const accountIndex = new Map(accounts.map((account, index) => [account.address, index]))
  const compiledInstructions = message.instructions.map((instruction) =>
    encodeCompiledInstruction(instruction, accountIndex),
  )
  const numReadonlySignerAccounts = signerAccounts.filter(
    (account) => !isWritable(account.role),
  ).length
  const numReadonlyNonSignerAccounts = accounts.filter(
    (account) => !isSigner(account.role) && !isWritable(account.role),
  ).length

  const messageBytes = concat(
    Uint8Array.of(
      0x80,
      signerAccounts.length,
      numReadonlySignerAccounts,
      numReadonlyNonSignerAccounts,
    ),
    encodeShortU16(accounts.length),
    ...accounts.map((account) => addressToBytes(account.address)),
    addressToBytes(message.lifetimeConstraint.blockhash),
    encodeShortU16(compiledInstructions.length),
    ...compiledInstructions,
    encodeShortU16(0), // No address lookup tables.
  )
  const signatures = Object.fromEntries(
    signerAccounts.map((account) => [account.address, null]),
  ) as Record<Address, Uint8Array | null>
  return { messageBytes, signatures, lifetimeConstraint: message.lifetimeConstraint }
}

/** Kit-shaped: `partiallySignTransaction(keyPairs, transaction)` from `@solana/transactions`. */
export const partiallySignTransaction = Effect.fnUntraced(function* <T extends Transaction>(
  keyPairs: ReadonlyArray<CryptoKeyPair>,
  transaction: T,
) {
  let signatures: Record<Address, Uint8Array | null> = { ...transaction.signatures }
  for (const keyPair of keyPairs) {
    const address = yield* addressFromPublicKey(keyPair.publicKey)
    if (!(address in signatures)) {
      return yield* Effect.fail(
        new SvmProtocolError({
          message: `Address is not required to sign this transaction: ${address}`,
        }),
      )
    }
    signatures = {
      ...signatures,
      [address]: yield* sign(Ed25519PrivateKey.make(keyPair.privateKey), transaction.messageBytes),
    }
  }
  return { ...transaction, signatures } as T
})

const getWireTransactionBytes = (transaction: Transaction): Uint8Array => {
  const signatures = Object.values(transaction.signatures)
  if (signatures.length === 0)
    throw new SvmProtocolError({ message: "A transaction must have at least one signer" })
  const wire = concat(
    encodeShortU16(signatures.length),
    ...signatures.map((signature) => signature ?? new Uint8Array(64)),
    transaction.messageBytes,
  )
  if (wire.length > 1232) {
    throw new SvmProtocolError({ message: `Transaction exceeds 1232 bytes: ${wire.length}` })
  }
  return wire
}

export const getBase64EncodedWireTransaction = (transaction: Transaction): string =>
  Encoding.encodeBase64(getWireTransactionBytes(transaction))
