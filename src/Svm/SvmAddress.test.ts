import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit, Option } from "effect"

import {
  address,
  addressFromBytes,
  addressToBytes,
  base58Decode,
  base58Encode,
  SvmAddress,
} from "./SvmAddress.ts"

describe(import.meta.url, () => {
  it("roundtrips 32-byte addresses including all zeroes", () => {
    const zeroes = new Uint8Array(32)
    expect(base58Encode(zeroes)).toBe("11111111111111111111111111111111")
    expect(base58Decode("11111111111111111111111111111111")).toEqual(Option.some(zeroes))
    expect(addressToBytes(SvmAddress.make(base58Encode(zeroes)))).toEqual(zeroes)
  })

  it.effect(
    "rejects Base58 values that are not 32 bytes",
    Effect.fn(function* () {
      expect(Exit.isFailure(yield* Effect.exit(address("1111")))).toBe(true)
    }),
  )

  it.effect(
    "rejects non-32-byte public key material",
    Effect.fn(function* () {
      expect(Exit.isFailure(yield* Effect.exit(addressFromBytes(new Uint8Array(31))))).toBe(true)
    }),
  )
})
