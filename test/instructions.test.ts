import { describe, expect, it } from "vitest"

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
    expect([...getSetComputeUnitLimitInstruction(100_000).data!]).toEqual([2, 160, 134, 1, 0])
    expect([...getSetComputeUnitPriceInstruction(100_000n).data!]).toEqual([3, 160, 134, 1, 0, 0, 0, 0, 0])
    expect(new TextDecoder().decode(getAddMemoInstruction("hello").data)).toBe("hello")
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
    expect(instruction.accounts?.map((account) => account.role)).toEqual([
      AccountRole.WRITABLE,
      AccountRole.READONLY,
      AccountRole.WRITABLE,
      AccountRole.READONLY_SIGNER,
    ])
    expect([...instruction.data!]).toEqual([12, 64, 66, 15, 0, 0, 0, 0, 0, 6])
  })

  it("derives the associated token address", async () => {
    const [ata, bump] = await findAssociatedTokenPda({ owner, mint, tokenProgram })
    expect(ata).toBe("4LNjjuvNT3YkfmQhMRMBJriwsTTvNzPahTPoBEJVuA3x")
    expect(bump).toBe(255)
  })
})
