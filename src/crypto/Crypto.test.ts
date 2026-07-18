import { describe, expect, it } from "@effect/vitest"
import { Effect, Encoding, Exit } from "effect"

import * as Mnemonic from "../Mnemonic.ts"
import { SvmAddress } from "../Svm/Svm.ts"
import { mnemonicText } from "../Svm/Transaction.fixtures.ts"
import { Ed25519Pair, Ed25519PrivateKey, Ed25519PublicKey, Slip10 } from "./Crypto.ts"

const seed = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])

describe(import.meta.url, () => {
  it.effect(
    "matches the BIP-39 mnemonic-to-seed vector",
    Effect.fn(function* () {
      expect(Encoding.encodeHex(yield* Mnemonic.toSeed(Mnemonic.fromText(mnemonicText)))).toBe(
        "5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4",
      )
    }),
  )

  it.effect(
    "matches the existing Solana derivation vector",
    Effect.fn(function* () {
      const { privateKeySeed } = yield* Slip10.derive(seed, [44, 501, 0, 0])
      const pair = yield* Ed25519Pair.fromSeed(privateKeySeed)
      const message = new TextEncoder().encode("crosshatching")
      const signature = yield* Ed25519PrivateKey.sign(pair.privateKey, message)
      expect(Encoding.encodeHex(privateKeySeed)).toBe(
        "f1f890d181d1bc1fdfdb9e1911e59285b9f8a28c5c31c13e56747e6993bfa053",
      )
      expect(yield* SvmAddress.addressFromPublicKey(pair.publicKey)).toBe(
        "39LoiUgZejnJYJVhvvAnxkMooM1uJ15Hkiz2iXTUwF65",
      )
      expect(yield* Ed25519PublicKey.verify(pair.publicKey, signature, message)).toBe(true)
      expect(pair.privateKey.extractable).toBe(false)
    }),
  )

  it.effect(
    "rejects invalid SLIP-0010 path components",
    Effect.fn(function* () {
      expect(Exit.isFailure(yield* Effect.exit(Slip10.derive(seed, [-1])))).toBe(true)
      expect(Exit.isFailure(yield* Effect.exit(Slip10.derive(seed, [1.5])))).toBe(true)
      expect(Exit.isFailure(yield* Effect.exit(Slip10.derive(seed, [2147483648])))).toBe(true)
    }),
  )

  it.effect(
    "rejects a seed that is not 32 bytes",
    Effect.fn(function* () {
      expect(Exit.isFailure(yield* Effect.exit(Ed25519Pair.fromSeed(new Uint8Array(31))))).toBe(
        true,
      )
    }),
  )
})
