/**
 * Treatment: compile + sign fixture path from Transaction.test.ts
 * Baseline: Transaction.fixtures.ts golden bytes (official kit fixtures)
 * Also structural checks on message header / account counts / shortu16.
 */
import { Effect, Encoding, Exit } from "effect"
import { Ed25519Pair, Slip10 } from "../src/Crypto/Crypto.ts"
import * as Mnemonic from "../src/Mnemonic.ts"
import {
  findAssociatedTokenPda,
  getAddMemoInstruction,
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
  getTransferCheckedInstruction,
} from "../src/Svm/Instructions.ts"
import { addressFromPublicKey, Blockhash, SvmAddress } from "../src/Svm/SvmAddress.ts"
import {
  expectedMessage,
  expectedPartialMessage,
  expectedPartialWire,
  expectedWire,
  mnemonicText,
} from "../src/Svm/Transaction.fixtures.ts"
import {
  compileTransaction,
  encodeSignedTransactionMessage,
  getBase64EncodedWireTransaction,
  partiallySignTransaction,
  signTransactionMessage,
} from "../src/Svm/Transaction.ts"
import { buildTransactionMessage } from "../src/Svm/TransactionMessage.ts"

const mint = SvmAddress.make("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
const tokenProgram = SvmAddress.make("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
const blockhash = Blockhash.make("11111111111111111111111111111111")
const system = SvmAddress.make("11111111111111111111111111111112")

const result = await Effect.runPromise(
  Effect.gen(function* () {
    const seed = yield* Mnemonic.toSeed(Mnemonic.fromText(mnemonicText))
    const { privateKeySeed } = yield* Slip10.derive(seed, [44, 501, 0, 0])
    const keypair = yield* Ed25519Pair.fromSeed(privateKeySeed)
    const signerAddress = yield* addressFromPublicKey(keypair.publicKey)

    const [[source], [destination]] = yield* Effect.all([
      findAssociatedTokenPda({ owner: signerAddress, mint, tokenProgram }),
      findAssociatedTokenPda({ owner: system, mint, tokenProgram }),
    ])

    const fullMsg = buildTransactionMessage({
      feePayer: signerAddress,
      lifetimeConstraint: { blockhash, lastValidBlockHeight: 1n },
      instructions: [
        yield* getSetComputeUnitLimitInstruction(100_000),
        yield* getSetComputeUnitPriceInstruction(100_000n),
        yield* getTransferCheckedInstruction({
          source,
          mint,
          destination,
          authority: signerAddress,
          tokenProgram,
          amount: 1_000_000n,
          decimals: 6,
        }),
        getAddMemoInstruction("bye @solana/kit"),
      ],
    })

    const fullCompiled = yield* compileTransaction(fullMsg)
    const fullMessageHex = Encoding.encodeHex(fullCompiled.messageBytes)
    const fullWire = yield* encodeSignedTransactionMessage(fullMsg, [keypair])

    const partialMsg = buildTransactionMessage({
      feePayer: system,
      lifetimeConstraint: { blockhash, lastValidBlockHeight: 1n },
      instructions: [
        yield* getTransferCheckedInstruction({
          source,
          mint,
          destination,
          authority: signerAddress,
          tokenProgram,
          amount: 1_000_000n,
          decimals: 6,
        }),
      ],
    })
    const partialCompiled = yield* compileTransaction(partialMsg)
    const partialMessageHex = Encoding.encodeHex(partialCompiled.messageBytes)
    const partialSigned = yield* partiallySignTransaction([keypair], partialCompiled)
    const partialWire = yield* getBase64EncodedWireTransaction(partialSigned)

    // structural decode of full message
    const mb = fullCompiled.messageBytes
    const versionPrefix = mb[0]
    const numRequiredSignatures = mb[1]
    const numReadonlySigned = mb[2]
    const numReadonlyUnsigned = mb[3]

    // shortu16 at offset 4 for account count
    const decodeShortU16 = (bytes, offset) => {
      let value = 0
      let shift = 0
      let i = offset
      while (true) {
        const b = bytes[i++]
        value |= (b & 0x7f) << shift
        if ((b & 0x80) === 0) break
        shift += 7
      }
      return { value, next: i }
    }
    const { value: numAccounts, next: afterAccountsLen } = decodeShortU16(mb, 4)
    const accountsStart = afterAccountsLen
    const accountsBytes = mb.slice(accountsStart, accountsStart + numAccounts * 32)
    const feePayerBytes = accountsBytes.slice(0, 32)
    const feePayerFromMsg = (() => {
      // base58 via treatment
      return null
    })()

    // reject foreign signer
    const rejectExit = yield* Effect.exit(
      signTransactionMessage(
        buildTransactionMessage({
          feePayer: system,
          lifetimeConstraint: { blockhash, lastValidBlockHeight: 1n },
          instructions: [getAddMemoInstruction("no signer")],
        }),
        [keypair],
      ),
    )

    return {
      full: {
        messageMatch: fullMessageHex === expectedMessage,
        wireMatch: fullWire === expectedWire,
        messageHex: fullMessageHex,
        expectedMessage,
        wire: fullWire,
        expectedWire,
        structure: {
          versionPrefix,
          versionedV0_flag: versionPrefix === 0x80,
          numRequiredSignatures,
          numReadonlySigned,
          numReadonlyUnsigned,
          numAccounts,
          messageByteLength: mb.length,
          expectedMessageByteLength: expectedMessage.length / 2,
        },
      },
      partial: {
        messageMatch: partialMessageHex === expectedPartialMessage,
        wireMatch: partialWire === expectedPartialWire,
        systemSigNull: partialSigned.signatures[system] === null,
        messageHex: partialMessageHex,
        wire: partialWire,
      },
      rejectNonRequiredSigner: Exit.isFailure(rejectExit),
      signerAddress,
      source,
      destination,
    }
  }),
)

const checks = {
  full_message_bytes: result.full.messageMatch,
  full_wire_base64: result.full.wireMatch,
  partial_message_bytes: result.partial.messageMatch,
  partial_wire_base64: result.partial.wireMatch,
  partial_fee_payer_sig_null: result.partial.systemSigNull,
  reject_non_required_signer: result.rejectNonRequiredSigner,
  versioned_prefix_0x80: result.full.structure.versionedV0_flag,
  message_len_matches_fixture: result.full.structure.messageByteLength === result.full.structure.expectedMessageByteLength,
}

const allMatch = Object.values(checks).every(Boolean)
const out = {
  claim:
    "Fixture path compile/sign matches expectedMessage/expectedWire (+ partial + structural header)",
  allMatch,
  checks,
  structure: result.full.structure,
  signerAddress: result.signerAddress,
  atas: { source: result.source, destination: result.destination },
}
console.log(JSON.stringify(out, null, 2))
process.exit(allMatch ? 0 : 1)
