import { Effect, pipe } from "effect"

import * as Mnemonic from "./Mnemonic.ts"
import {
  findAssociatedTokenPda,
  getAddMemoInstruction,
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
  getTransferCheckedInstruction,
} from "./Svm/Instructions.ts"
import { address, Blockhash } from "./Svm/SvmAddress.ts"
import { layerMnemonic, SvmSigner } from "./Svm/SvmSigner.ts"
import { compileTransaction, getBase64EncodedWireTransaction } from "./Svm/Transaction.ts"
import {
  appendTransactionMessageInstructions,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from "./Svm/TransactionMessage.ts"

const mnemonic = Mnemonic.make(
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
)
const mint = address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
const recipient = address("11111111111111111111111111111112")
const tokenProgram = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")

const program = Effect.gen(function* () {
  const signer = yield* SvmSigner
  const [[source], [destination]] = yield* Effect.all([
    findAssociatedTokenPda({ owner: signer.address, mint, tokenProgram }),
    findAssociatedTokenPda({ owner: recipient, mint, tokenProgram }),
  ])
  const message = pipe(
    createTransactionMessage(),
    (value) => setTransactionMessageFeePayer(signer.address, value),
    (value) =>
      setTransactionMessageLifetimeUsingBlockhash(
        {
          blockhash: Blockhash.make("11111111111111111111111111111111"),
          lastValidBlockHeight: 1n,
        },
        value,
      ),
    (value) =>
      appendTransactionMessageInstructions(
        [
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
        ],
        value,
      ),
  )
  return {
    address: signer.address,
    transaction: getBase64EncodedWireTransaction(
      yield* signer.signTransaction(compileTransaction(message)),
    ),
  }
}).pipe(Effect.provide(layerMnemonic(mnemonic)))

console.log(JSON.stringify(await Effect.runPromise(program), null, 2))
