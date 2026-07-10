import { describe, expect, it } from "@effect/vitest"

import {
  address,
  addressFromBytes,
  addressToBytes,
  base58Decode,
  base58Encode,
} from "../src/Svm/SvmAddress.ts"

describe(import.meta.url, () => {
  it("roundtrips 32-byte addresses including all zeroes", () => {
    const zeroes = new Uint8Array(32)
    expect(base58Encode(zeroes)).toBe("11111111111111111111111111111111")
    expect(base58Decode("11111111111111111111111111111111")).toEqual(zeroes)
    expect(addressToBytes(addressFromBytes(zeroes))).toEqual(zeroes)
  })

  it("rejects Base58 values that are not 32 bytes", () => {
    expect(() => address("1111")).toThrow()
  })
})
