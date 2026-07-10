import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Effect, Encoding, Exit } from "effect"

import { pairFromPrivateKeyBytes, sign, verify } from "../src/crypto/ed25519.js"
import { toSeed } from "../src/crypto/mnemonic.js"
import { derivePrivateKey } from "../src/crypto/slip10.js"
import { addressFromPublicKey } from "../src/solana/address.js"

const seed = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])

describe("SLIP-0010 + WebCrypto Ed25519", () => {
  it("matches the BIP-39 mnemonic-to-seed vector", async () => {
    const mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
    const derived = await Effect.runPromise(toSeed(mnemonic))
    assert.equal(Encoding.encodeHex(derived),
      "5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4",
    )
  })

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

    assert.equal(Encoding.encodeHex(result.privateKey), "f1f890d181d1bc1fdfdb9e1911e59285b9f8a28c5c31c13e56747e6993bfa053")
    assert.equal(result.signerAddress, "39LoiUgZejnJYJVhvvAnxkMooM1uJ15Hkiz2iXTUwF65")
    assert.equal(result.signature.length, 64)
    assert.equal(result.valid, true)
    assert.equal(result.pair.privateKey.extractable, false)
  })

  it("rejects a seed that is not 32 bytes", async () => {
    const exit = await Effect.runPromiseExit(pairFromPrivateKeyBytes(new Uint8Array(31)))
    assert.equal(Exit.isFailure(exit), true)
  })
})
