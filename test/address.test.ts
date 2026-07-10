import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { address, addressFromBytes, addressToBytes, base58Decode, base58Encode } from "../src/solana/address.js"

describe("Solana addresses", () => {
  it("roundtrips 32-byte addresses including all zeroes", () => {
    const zeroes = new Uint8Array(32)
    assert.equal(base58Encode(zeroes), "11111111111111111111111111111111")
    assert.deepEqual(base58Decode("11111111111111111111111111111111"), zeroes)
    assert.deepEqual(addressToBytes(addressFromBytes(zeroes)), zeroes)
  })

  it("rejects Base58 values that are not 32 bytes", () => {
    assert.throws(() => address("1111"), /32 bytes/)
  })
})
