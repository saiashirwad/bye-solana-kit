import { Effect, Encoding } from "effect"

const PKCS8_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
])

export interface Ed25519Pair {
  readonly privateKey: CryptoKey
  readonly publicKey: CryptoKey
}

export const privateKeyFromBytes = (
  bytes: Uint8Array,
  options?: { readonly extractable?: boolean },
) =>
  Effect.gen(function* () {
    if (bytes.byteLength !== 32) {
      return yield* Effect.fail(new RangeError(`Ed25519 seed must be exactly 32 bytes; got ${bytes.byteLength}`))
    }
    const pkcs8 = new Uint8Array(PKCS8_PREFIX.length + bytes.length)
    pkcs8.set(PKCS8_PREFIX)
    pkcs8.set(bytes, PKCS8_PREFIX.length)
    return yield* Effect.promise(() =>
      crypto.subtle.importKey("pkcs8", pkcs8, "Ed25519", options?.extractable ?? false, ["sign"]),
    )
  })

/** Creates a WebCrypto keypair from a 32-byte Ed25519 seed. */
export const pairFromPrivateKeyBytes = (
  bytes: Uint8Array,
  options?: { readonly extractable?: boolean },
) =>
  Effect.gen(function* () {
    // WebCrypto exposes the public coordinate through an extractable private JWK.
    const extractablePrivateKey = yield* privateKeyFromBytes(bytes, { extractable: true })
    const jwk = yield* Effect.promise(() => crypto.subtle.exportKey("jwk", extractablePrivateKey))
    if (jwk.x === undefined) return yield* Effect.fail(new Error("Ed25519 private JWK has no public coordinate"))

    const publicKeyBytes = yield* Effect.fromResult(Encoding.decodeBase64Url(jwk.x))
    const publicKey = yield* Effect.promise(() =>
      crypto.subtle.importKey("raw", Uint8Array.from(publicKeyBytes), "Ed25519", true, ["verify"]),
    )
    const privateKey = options?.extractable === true
      ? extractablePrivateKey
      : yield* privateKeyFromBytes(bytes)
    return { privateKey, publicKey } satisfies Ed25519Pair
  })

export const sign = (privateKey: CryptoKey, data: Uint8Array) =>
  Effect.promise(() => crypto.subtle.sign("Ed25519", privateKey, data.slice())).pipe(
    Effect.map((signature) => new Uint8Array(signature)),
  )

export const verify = (publicKey: CryptoKey, signature: Uint8Array, data: Uint8Array) =>
  Effect.promise(() => crypto.subtle.verify("Ed25519", publicKey, signature.slice(), data.slice()))
