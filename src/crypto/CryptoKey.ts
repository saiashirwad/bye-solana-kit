import { Effect, flow, Schema as S, Encoding } from "effect"

export const CryptoKey = S.instanceOf(globalThis.CryptoKey).annotate({ identifier: "CryptoKey" })

export const toBytes = (key: typeof CryptoKey.Type) =>
  Effect.promise(() => crypto.subtle.exportKey("raw", key)).pipe(
    Effect.map((value) => new Uint8Array(value)),
  )

export const encodeHex = flow(toBytes, Effect.map(Encoding.encodeHex))
