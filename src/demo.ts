import { address } from "@solana/addresses"
import {
  appendTransactionMessageInstructions,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/transaction-messages"
import { blockhash } from "@solana/rpc-types"
import { compileTransaction, getBase64EncodedWireTransaction } from "@solana/transactions"
import { Effect, pipe } from "effect"

import {
  findAssociatedTokenPda,
  getAddMemoInstruction,
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
  getTransferCheckedInstruction,
} from "./solana/instructions.js"
import { signerFromMnemonic } from "./signer.js"

const mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
const mint = address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
const recipient = address("11111111111111111111111111111112")
const tokenProgram = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")

const program = Effect.gen(function* () {
  const signer = yield* signerFromMnemonic(mnemonic)
  const [[source], [destination]] = yield* Effect.all([
    Effect.promise(() => findAssociatedTokenPda({ owner: signer.address, mint, tokenProgram })),
    Effect.promise(() => findAssociatedTokenPda({ owner: recipient, mint, tokenProgram })),
  ])

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (value) => setTransactionMessageFeePayer(signer.address, value),
    (value) => setTransactionMessageLifetimeUsingBlockhash({
      blockhash: blockhash("11111111111111111111111111111111"),
      lastValidBlockHeight: 1n,
    }, value),
    (value) => appendTransactionMessageInstructions([
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
    ], value),
  )

  const signed = yield* signer.signTransaction(compileTransaction(message))
  return { address: signer.address, transaction: getBase64EncodedWireTransaction(signed) }
})

const result = await Effect.runPromise(program)
console.log(JSON.stringify(result, null, 2))
