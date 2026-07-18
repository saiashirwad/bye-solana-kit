import { describe, expect, it } from "@effect/vitest"
import { Effect, Encoding, Exit, pipe } from "effect"

import { Ed25519Pair, Slip10 } from "../src/Crypto/Crypto.ts"
import * as Mnemonic from "../src/Mnemonic.ts"
import {
  findAssociatedTokenPda,
  getAddMemoInstruction,
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
  getTransferCheckedInstruction,
} from "../src/Svm/Instructions.ts"
import { address, addressFromPublicKey, Blockhash } from "../src/Svm/SvmAddress.ts"
import {
  compileTransaction,
  getBase64EncodedWireTransaction,
  partiallySignTransaction,
} from "../src/Svm/Transaction.ts"
import {
  appendTransactionMessageInstructions,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Instruction,
} from "../src/Svm/TransactionMessage.ts"
import {
  expectedMessage,
  expectedPartialMessage,
  expectedPartialWire,
  expectedWire,
  mnemonicText,
} from "./Fixtures.ts"

const mint = address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
const tokenProgram = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
const blockhash = Blockhash.make("11111111111111111111111111111111")

const deriveKeypair = Effect.gen(function* () {
  const seed = yield* Mnemonic.toSeed(Mnemonic.fromText(mnemonicText))
  const { privateKeySeed } = yield* Slip10.derive(seed, [44, 501, 0, 0])
  const keypair = yield* Ed25519Pair.fromSeed(privateKeySeed)
  const signerAddress = yield* addressFromPublicKey(keypair.publicKey)
  return { keypair, signerAddress }
})

const message = (feePayer: ReturnType<typeof address>, instructions: ReadonlyArray<Instruction>) =>
  pipe(
    createTransactionMessage(),
    (v) => setTransactionMessageFeePayer(feePayer, v),
    (v) => setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight: 1n }, v),
    (v) => appendTransactionMessageInstructions(instructions, v),
  )

describe(import.meta.url, () => {
  it.effect(
    "matches the official compiled-message and wire fixtures byte-for-byte",
    Effect.fn(function* () {
      const { keypair, signerAddress } = yield* deriveKeypair
      const recipient = address("11111111111111111111111111111112")
      const [[source], [destination]] = yield* Effect.all([
        findAssociatedTokenPda({ owner: signerAddress, mint, tokenProgram }),
        findAssociatedTokenPda({ owner: recipient, mint, tokenProgram }),
      ])
      const transaction = compileTransaction(
        message(signerAddress, [
          getSetComputeUnitLimitInstruction(100_000),
          getSetComputeUnitPriceInstruction(100_000n),
          getTransferCheckedInstruction({
            source,
            mint,
            destination,
            authority: signerAddress,
            tokenProgram,
            amount: 1_000_000n,
            decimals: 6,
          }),
          getAddMemoInstruction("bye @solana/kit"),
        ]),
      )
      expect(Encoding.encodeHex(transaction.messageBytes)).toBe(expectedMessage)
      expect(
        getBase64EncodedWireTransaction(yield* partiallySignTransaction([keypair], transaction)),
      ).toBe(expectedWire)
    }),
  )

  it.effect(
    "rejects a signer that is not required by the transaction",
    Effect.fn(function* () {
      const { keypair } = yield* deriveKeypair
      const transaction = compileTransaction(
        message(address("11111111111111111111111111111112"), [getAddMemoInstruction("no signer")]),
      )
      expect(
        Exit.isFailure(yield* Effect.exit(partiallySignTransaction([keypair], transaction))),
      ).toBe(true)
    }),
  )

  it.effect(
    "matches the official partial-signing fixture with an external fee payer",
    Effect.fn(function* () {
      const { keypair, signerAddress } = yield* deriveKeypair
      const feePayer = address("11111111111111111111111111111112")
      const [[source], [destination]] = yield* Effect.all([
        findAssociatedTokenPda({ owner: signerAddress, mint, tokenProgram }),
        findAssociatedTokenPda({ owner: feePayer, mint, tokenProgram }),
      ])
      const transaction = compileTransaction(
        message(feePayer, [
          getTransferCheckedInstruction({
            source,
            mint,
            destination,
            authority: signerAddress,
            tokenProgram,
            amount: 1_000_000n,
            decimals: 6,
          }),
        ]),
      )
      expect(Encoding.encodeHex(transaction.messageBytes)).toBe(expectedPartialMessage)
      const signed = yield* partiallySignTransaction([keypair], transaction)
      expect(signed.signatures[feePayer]).toBeNull()
      expect(getBase64EncodedWireTransaction(signed)).toBe(expectedPartialWire)
    }),
  )
})
