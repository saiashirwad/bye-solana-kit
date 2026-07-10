import { Effect } from "effect"

import { pairFromPrivateKeyBytes, sign } from "./crypto/ed25519.js"
import { toSeed } from "./crypto/mnemonic.js"
import { derivePrivateKey } from "./crypto/slip10.js"
import { addressFromPublicKey, type Address } from "./solana/address.js"
import { partiallySignTransaction, type Transaction } from "./solana/transaction.js"

export interface SvmSigner {
  readonly address: Address
  readonly sign: (data: Uint8Array) => Effect.Effect<Uint8Array>
  readonly signTransaction: <T extends Transaction>(transaction: T) => Effect.Effect<T>
}

export const signerFromMnemonic = (mnemonic: string) =>
  Effect.gen(function* () {
    const seed = yield* toSeed(mnemonic)
    const privateKeyBytes = yield* derivePrivateKey(seed, [44, 501, 0, 0])
    const pair = yield* pairFromPrivateKeyBytes(privateKeyBytes)
    const signerAddress = yield* addressFromPublicKey(pair.publicKey)

    return {
      address: signerAddress,
      sign: (data) => sign(pair.privateKey, data),
      signTransaction: <T extends Transaction>(transaction: T) =>
        Effect.promise(() => partiallySignTransaction(transaction, { address: signerAddress, privateKey: pair.privateKey })),
    } satisfies SvmSigner
  })
