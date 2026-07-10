import { describe, expect, it } from "vitest"

import { address, addressFromBytes, addressToBytes, base58Decode, base58Encode } from "../src/solana/address.js"

describe("Solana addresses", () => {
  it("roundtrips 32-byte addresses including all zeroes", () => {
    const zeroes = new Uint8Array(32)
    expect(base58Encode(zeroes)).toBe("11111111111111111111111111111111")
    expect(base58Decode("11111111111111111111111111111111")).toEqual(zeroes)
    expect(addressToBytes(addressFromBytes(zeroes))).toEqual(zeroes)
  })

  it("rejects Base58 values that are not 32 bytes", () => {
    expect(() => address("1111")).toThrow(/32 bytes/)
  })
})
