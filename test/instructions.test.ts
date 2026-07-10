import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  findAssociatedTokenPda,
  getAddMemoInstruction,
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
  getTransferCheckedInstruction,
} from "../src/solana/instructions.js"
import { address } from "../src/solana/address.js"
import { AccountRole } from "../src/solana/message.js"

const mint = address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
const owner = address("39LoiUgZejnJYJVhvvAnxkMooM1uJ15Hkiz2iXTUwF65")
const tokenProgram = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")

describe("local instruction builders", () => {
  it("encodes compute budget and memo instructions", () => {
    assert.deepEqual([...getSetComputeUnitLimitInstruction(100_000).data!], [2, 160, 134, 1, 0])
    assert.deepEqual([...getSetComputeUnitPriceInstruction(100_000n).data!], [3, 160, 134, 1, 0, 0, 0, 0, 0])
    assert.equal(new TextDecoder().decode(getAddMemoInstruction("hello").data), "hello")
  })

  it("encodes transferChecked accounts and data", () => {
    const instruction = getTransferCheckedInstruction({
      source: owner,
      mint,
      destination: owner,
      authority: owner,
      tokenProgram,
      amount: 1_000_000n,
      decimals: 6,
    })
    assert.deepEqual(instruction.accounts?.map((account) => account.role), [
      AccountRole.WRITABLE,
      AccountRole.READONLY,
      AccountRole.WRITABLE,
      AccountRole.READONLY_SIGNER,
    ])
    assert.deepEqual([...instruction.data!], [12, 64, 66, 15, 0, 0, 0, 0, 0, 6])
  })

  it("derives the associated token address", async () => {
    const [ata, bump] = await findAssociatedTokenPda({ owner, mint, tokenProgram })
    assert.equal(ata, "4LNjjuvNT3YkfmQhMRMBJriwsTTvNzPahTPoBEJVuA3x")
    assert.equal(bump, 255)
  })
})
