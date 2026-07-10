import { Effect, Encoding, Schema as S } from "effect"

import { CryptoError } from "./CryptoError.ts"
import { Ed25519PrivateKey, fromBytes as privateKeyFromBytes } from "./Ed25519PrivateKey.ts"
import { Ed25519PublicKey, fromBytes as publicKeyFromBytes } from "./Ed25519PublicKey.ts"

const TypeId = "crosshatch/Ed25519Pair" as const

export class Ed25519Pair extends S.Class<Ed25519Pair>("Ed25519Pair")({
  [TypeId]: S.tag(TypeId),
  privateKey: Ed25519PrivateKey,
  publicKey: Ed25519PublicKey,
}) {}

export const fromPrivateKeyBytes = Effect.fnUntraced(function* (
  bytes: Uint8Array,
  config?: { readonly extractable?: boolean | undefined },
) {
  const extractablePrivateKey = yield* privateKeyFromBytes(bytes, { extractable: true })
  const jwk = yield* Effect.promise(() => crypto.subtle.exportKey("jwk", extractablePrivateKey))
  if (jwk.x === undefined) {
    return yield* Effect.fail(
      new CryptoError({ message: "Ed25519 private JWK has no public coordinate" }),
    )
  }
  const publicKeyBytes = yield* Effect.fromResult(Encoding.decodeBase64Url(jwk.x))
  const publicKey = yield* publicKeyFromBytes(publicKeyBytes)
  const privateKey =
    config?.extractable === true ? extractablePrivateKey : yield* privateKeyFromBytes(bytes)
  return Ed25519Pair.make({ privateKey, publicKey })
})
