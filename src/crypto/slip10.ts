import { Effect } from "effect"

const HARDENED = 0x80000000
const MAX_INDEX = HARDENED - 1
const ED25519_SEED = new TextEncoder().encode("ed25519 seed")

interface Node {
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

const nodeFromDigest = (digest: Uint8Array): Node => ({
  privateKey: digest.slice(0, 32),
  chainCode: digest.slice(32),
})

const deriveChild = Effect.fnUntraced(function* (node: Node, index: number) {
  const data = new Uint8Array(37)
  data[0] = 0
  data.set(node.privateKey, 1)
  new DataView(data.buffer).setUint32(33, index + HARDENED, false)
  return nodeFromDigest(yield* hmacSha512(node.chainCode, data))
})

/** All path components are hardened; [44, 501, 0, 0] means m/44'/501'/0'/0'. */
export const derivePrivateKey = Effect.fnUntraced(function* (
  seed: Uint8Array,
  path: ReadonlyArray<number>,
) {
  for (const index of path) {
    if (!Number.isInteger(index) || index < 0 || index > MAX_INDEX) {
      return yield* Effect.fail(new RangeError(`Invalid SLIP-0010 path component: ${index}`))
    }
  }

  let node = nodeFromDigest(yield* hmacSha512(ED25519_SEED, seed))
  for (const index of path) node = yield* deriveChild(node, index)
  return node.privateKey
})
