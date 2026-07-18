import { Effect, pipe } from "effect"

import { Ed25519Pair, Slip10 } from "./Crypto/Crypto.ts"
import * as Mnemonic from "./Mnemonic.ts"
import {
  findAssociatedTokenPda,
  getAddMemoInstruction,
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
  getTransferCheckedInstruction,
} from "./Svm/Instructions.ts"
import { address, addressFromPublicKey, Blockhash } from "./Svm/SvmAddress.ts"
import {
  compileTransaction,
  getBase64EncodedWireTransaction,
  partiallySignTransaction,
} from "./Svm/Transaction.ts"
import {
  appendTransactionMessageInstructions,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from "./Svm/TransactionMessage.ts"

const mnemonic = Mnemonic.fromText(
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
)
const mint = address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
const recipient = address("11111111111111111111111111111112")
const tokenProgram = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")

const program = Effect.gen(function* () {
  const seed = yield* Mnemonic.toSeed(mnemonic)
  const { privateKeySeed } = yield* Slip10.derive(seed, [44, 501, 0, 0])
  const keypair = yield* Ed25519Pair.fromSeed(privateKeySeed)
  const signerAddress = yield* addressFromPublicKey(keypair.publicKey)

  const [[source], [destination]] = yield* Effect.all([
    findAssociatedTokenPda({ owner: signerAddress, mint, tokenProgram }),
    findAssociatedTokenPda({ owner: recipient, mint, tokenProgram }),
  ])

  const message = pipe(
    createTransactionMessage(),
    (v) => setTransactionMessageFeePayer(signerAddress, v),
    (v) =>
      setTransactionMessageLifetimeUsingBlockhash(
        {
          blockhash: Blockhash.make("11111111111111111111111111111111"),
          lastValidBlockHeight: 1n,
        },
        v,
      ),
    (v) =>
      appendTransactionMessageInstructions(
        [
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
        ],
        v,
      ),
  )

  const signed = yield* partiallySignTransaction([keypair], compileTransaction(message))
  return {
    address: signerAddress,
    transaction: getBase64EncodedWireTransaction(signed),
  }
})

console.log(JSON.stringify(await Effect.runPromise(program), null, 2))
