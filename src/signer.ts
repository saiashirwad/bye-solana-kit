import { getAddressFromPublicKey, type Address } from "@solana/addresses"
import { partiallySignTransaction, type Transaction } from "@solana/transactions"
import { Effect } from "effect"
import { Mnemonic } from "ox"

import { pairFromPrivateKeyBytes, sign } from "./crypto/ed25519.js"
import { derivePrivateKey } from "./crypto/slip10.js"

export interface SvmSigner {
  readonly address: Address
  readonly sign: (data: Uint8Array) => Effect.Effect<Uint8Array>
  readonly signTransaction: <T extends Transaction>(transaction: T) => Effect.Effect<T>
}

export const signerFromMnemonic = (mnemonic: string) =>
  Effect.gen(function* () {
    const seed = Mnemonic.toSeed(mnemonic)
    const privateKeyBytes = yield* derivePrivateKey(seed, [44, 501, 0, 0])
    const pair = yield* pairFromPrivateKeyBytes(privateKeyBytes)
    const signerAddress = yield* Effect.promise(() => getAddressFromPublicKey(pair.publicKey))
    const keyPair: CryptoKeyPair = pair

    return {
      address: signerAddress,
      sign: (data) => sign(pair.privateKey, data),
      signTransaction: <T extends Transaction>(transaction: T) =>
        Effect.promise(() => partiallySignTransaction([keyPair], transaction)),
    } satisfies SvmSigner
  })
