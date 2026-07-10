import { describe, expect, it } from "@effect/vitest"
import { Effect, Encoding, Exit, pipe } from "effect"

import * as Mnemonic from "../src/Mnemonic.ts"
import {
  findAssociatedTokenPda,
  getAddMemoInstruction,
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
  getTransferCheckedInstruction,
} from "../src/Svm/Instructions.ts"
import { address, Blockhash } from "../src/Svm/SvmAddress.ts"
import { layerMnemonic, SvmSigner } from "../src/Svm/SvmSigner.ts"
import { compileTransaction, getBase64EncodedWireTransaction } from "../src/Svm/Transaction.ts"
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

const Live = layerMnemonic(Mnemonic.make(mnemonicText))
const mint = address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
const tokenProgram = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
const blockhash = Blockhash.make("11111111111111111111111111111111")

const message = (feePayer: ReturnType<typeof address>, instructions: ReadonlyArray<Instruction>) =>
  pipe(
    createTransactionMessage(),
    (value) => setTransactionMessageFeePayer(feePayer, value),
    (value) =>
      setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight: 1n }, value),
    (value) => appendTransactionMessageInstructions(instructions, value),
  )

describe(import.meta.url, () => {
  it.effect(
    "matches the official compiled-message and wire fixtures byte-for-byte",
    Effect.fn(function* () {
      const signer = yield* SvmSigner
      const recipient = address("11111111111111111111111111111112")
      const [[source], [destination]] = yield* Effect.all([
        findAssociatedTokenPda({ owner: signer.address, mint, tokenProgram }),
        findAssociatedTokenPda({ owner: recipient, mint, tokenProgram }),
      ])
      const transaction = compileTransaction(
        message(signer.address, [
          getSetComputeUnitLimitInstruction(100_000),
          getSetComputeUnitPriceInstruction(100_000n),
          getTransferCheckedInstruction({
            source,
            mint,
            destination,
            authority: signer.address,
            tokenProgram,
            amount: 1_000_000n,
            decimals: 6,
          }),
          getAddMemoInstruction("bye @solana/kit"),
        ]),
      )
      expect(Encoding.encodeHex(transaction.messageBytes)).toBe(expectedMessage)
      expect(getBase64EncodedWireTransaction(yield* signer.signTransaction(transaction))).toBe(
        expectedWire,
      )
    }, Effect.provide(Live)),
  )

  it.effect(
    "rejects a signer that is not required by the transaction",
    Effect.fn(function* () {
      const signer = yield* SvmSigner
      const transaction = compileTransaction(
        message(address("11111111111111111111111111111112"), [getAddMemoInstruction("no signer")]),
      )
      expect(Exit.isFailure(yield* Effect.exit(signer.signTransaction(transaction)))).toBe(true)
    }, Effect.provide(Live)),
  )

  it.effect(
    "matches the official partial-signing fixture with an external fee payer",
    Effect.fn(function* () {
      const signer = yield* SvmSigner
      const feePayer = address("11111111111111111111111111111112")
      const [[source], [destination]] = yield* Effect.all([
        findAssociatedTokenPda({ owner: signer.address, mint, tokenProgram }),
        findAssociatedTokenPda({ owner: feePayer, mint, tokenProgram }),
      ])
      const transaction = compileTransaction(
        message(feePayer, [
          getTransferCheckedInstruction({
            source,
            mint,
            destination,
            authority: signer.address,
            tokenProgram,
            amount: 1_000_000n,
            decimals: 6,
          }),
        ]),
      )
      expect(Encoding.encodeHex(transaction.messageBytes)).toBe(expectedPartialMessage)
      const signed = yield* signer.signTransaction(transaction)
      expect(signed.signatures[feePayer]).toBeNull()
      expect(getBase64EncodedWireTransaction(signed)).toBe(expectedPartialWire)
    }, Effect.provide(Live)),
  )
})
