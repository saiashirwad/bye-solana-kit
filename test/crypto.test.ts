import { Effect, Encoding, Exit } from "effect"
import { describe, expect, it } from "vitest"

import { pairFromPrivateKeyBytes, sign, verify } from "../src/crypto/ed25519.js"
import { derivePrivateKey } from "../src/crypto/slip10.js"
import { addressFromPublicKey } from "../src/solana/address.js"

const seed = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])

describe("SLIP-0010 + WebCrypto Ed25519", () => {
  it("matches the existing Solana derivation vector", async () => {
    const result = await Effect.runPromise(Effect.gen(function* () {
      const privateKey = yield* derivePrivateKey(seed, [44, 501, 0, 0])
      const pair = yield* pairFromPrivateKeyBytes(privateKey)
      const signerAddress = yield* addressFromPublicKey(pair.publicKey)
      const message = new TextEncoder().encode("crosshatching")
      const signature = yield* sign(pair.privateKey, message)
      const valid = yield* verify(pair.publicKey, signature, message)
      return { privateKey, pair, signerAddress, signature, valid }
    }))

    expect(Encoding.encodeHex(result.privateKey)).toBe("f1f890d181d1bc1fdfdb9e1911e59285b9f8a28c5c31c13e56747e6993bfa053")
    expect(result.signerAddress).toBe("39LoiUgZejnJYJVhvvAnxkMooM1uJ15Hkiz2iXTUwF65")
    expect(result.signature).toHaveLength(64)
    expect(result.valid).toBe(true)
    expect(result.pair.privateKey.extractable).toBe(false)
  })

  it("rejects a seed that is not 32 bytes", async () => {
    const exit = await Effect.runPromiseExit(pairFromPrivateKeyBytes(new Uint8Array(31)))
    expect(Exit.isFailure(exit)).toBe(true)
  })
})
