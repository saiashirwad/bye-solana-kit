import { Effect, Schema as S } from "effect"

import { CryptoKey } from "./CryptoKey.ts"

export const Ed25519PublicKey = CryptoKey.pipe(S.brand("crosshatch/Ed25519PublicKey"))

export const fromBytes = (bytes: Uint8Array) =>
  Effect.promise(() =>
    crypto.subtle.importKey("raw", Uint8Array.from(bytes), "Ed25519", true, ["verify"]),
  ).pipe(Effect.map(Ed25519PublicKey.make))

export const verify = (
  publicKey: typeof Ed25519PublicKey.Type,
  signature: Uint8Array,
  data: Uint8Array,
) =>
  Effect.promise(() => crypto.subtle.verify("Ed25519", publicKey, signature.slice(), data.slice()))
