import { Context, Effect, Layer } from "effect"

import * as Boundary from "../Boundary.ts"
import { Ed25519Pair, Ed25519PrivateKey, Slip10 } from "../Crypto/Crypto.ts"
import * as Mnemonic from "../Mnemonic.ts"
import { addressFromPublicKey, type Address } from "./SvmAddress.ts"
import type { SvmProtocolError } from "./SvmError.ts"
import { partiallySignTransaction, type Transaction } from "./Transaction.ts"

export class SvmSigner extends Context.Service<
  SvmSigner,
  {
    readonly address: Address
    readonly sign: (data: Uint8Array) => Effect.Effect<Uint8Array>
    readonly signTransaction: <T extends Transaction>(
      transaction: T,
    ) => Effect.Effect<T, SvmProtocolError>
  }
>()("crosshatch/Svm/SvmSigner") {}

export const layerMnemonic = (mnemonic: typeof Mnemonic.Mnemonic.Type) =>
  Layer.effect(
    SvmSigner,
    Effect.gen(function* () {
      const seed = yield* Mnemonic.toSeed(mnemonic)
      const privateKeyBytes = yield* Slip10.derivePrivateKey(seed, [44, 501, 0, 0])
      const pair = yield* Ed25519Pair.fromPrivateKeyBytes(privateKeyBytes)
      const signerAddress = yield* addressFromPublicKey(pair.publicKey)

      return {
        address: signerAddress,
        sign: (data: Uint8Array) => Ed25519PrivateKey.sign(pair.privateKey, data),
        signTransaction: <T extends Transaction>(transaction: T) =>
          partiallySignTransaction(transaction, {
            address: signerAddress,
            privateKey: pair.privateKey,
          }).pipe(Boundary.span("svm-sign-transaction", import.meta.url)),
      }
    }).pipe(Boundary.span("svm-signer", import.meta.url)),
  )
