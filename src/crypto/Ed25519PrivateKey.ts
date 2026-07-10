import { Effect, Schema as S } from "effect"

import { CryptoError } from "./CryptoError.ts"
import { CryptoKey } from "./CryptoKey.ts"

export const Ed25519PrivateKey = CryptoKey.pipe(S.brand("crosshatch/Ed25519PrivateKey"))

const PKCS8_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
])

export const fromBytes = Effect.fnUntraced(function* (
  bytes: Uint8Array,
  config?: { readonly extractable?: boolean | undefined },
) {
  if (bytes.byteLength !== 32) {
    return yield* Effect.fail(
      new CryptoError({
        message: `Ed25519 seed must be exactly 32 bytes; got ${bytes.byteLength}`,
      }),
    )
  }
  const pkcs8 = new Uint8Array(PKCS8_PREFIX.length + bytes.length)
  pkcs8.set(PKCS8_PREFIX)
  pkcs8.set(bytes, PKCS8_PREFIX.length)
  return yield* Effect.promise(() =>
    crypto.subtle.importKey("pkcs8", pkcs8, "Ed25519", config?.extractable ?? false, ["sign"]),
  ).pipe(Effect.map(Ed25519PrivateKey.make))
})

export const sign = (privateKey: typeof Ed25519PrivateKey.Type, data: Uint8Array) =>
  Effect.promise(() => crypto.subtle.sign("Ed25519", privateKey, data.slice())).pipe(
    Effect.map((signature) => new Uint8Array(signature)),
  )
