import { Effect } from "effect"

import { CryptoError } from "./CryptoError.ts"

const HARDENED = 0x80000000
const MAX_INDEX = HARDENED - 1
const ED25519_SEED = new TextEncoder().encode("ed25519 seed")

interface Slip10Node {
  readonly privateKey: Uint8Array
  readonly chainCode: Uint8Array
}

const hmacSha512 = Effect.fnUntraced(function* (key: Uint8Array, data: Uint8Array) {
  const hmacKey = yield* Effect.promise(() =>
    crypto.subtle.importKey("raw", key.slice(), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]),
  )
  const digest = yield* Effect.promise(() => crypto.subtle.sign("HMAC", hmacKey, data.slice()))
  return new Uint8Array(digest)
})

const toNode = (digest: Uint8Array): Slip10Node => ({
  privateKey: digest.slice(0, 32),
  chainCode: digest.slice(32),
})

const child = Effect.fnUntraced(function* (node: Slip10Node, index: number) {
  const data = new Uint8Array(37)
  data[0] = 0
  data.set(node.privateKey, 1)
  new DataView(data.buffer).setUint32(33, index + HARDENED, false)
  return toNode(yield* hmacSha512(node.chainCode, data))
})

export const derivePrivateKey = Effect.fnUntraced(function* (
  seed: Uint8Array,
  path: ReadonlyArray<number>,
) {
  for (const index of path) {
    if (!Number.isInteger(index) || index < 0 || index > MAX_INDEX) {
      return yield* Effect.fail(
        new CryptoError({ message: `Invalid SLIP-0010 path component: ${index}` }),
      )
    }
  }

  let node = toNode(yield* hmacSha512(ED25519_SEED, seed))
  for (const index of path) node = yield* child(node, index)
  return node.privateKey
})
