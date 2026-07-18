import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import {
  findAssociatedTokenPda,
  getAddMemoInstruction,
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
  getTransferCheckedInstruction,
} from "./Instructions.ts"
import { SvmAddress } from "./SvmAddress.ts"
import { AccountRole } from "./TransactionMessage.ts"

const mint = SvmAddress.make("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
const owner = SvmAddress.make("39LoiUgZejnJYJVhvvAnxkMooM1uJ15Hkiz2iXTUwF65")
const tokenProgram = SvmAddress.make("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")

describe(import.meta.url, () => {
  it.effect(
    "encodes compute budget and memo instructions",
    Effect.fn(function* () {
      expect([...(yield* getSetComputeUnitLimitInstruction(100_000)).data!]).toEqual([
        2, 160, 134, 1, 0,
      ])
      expect([...(yield* getSetComputeUnitPriceInstruction(100_000n)).data!]).toEqual([
        3, 160, 134, 1, 0, 0, 0, 0, 0,
      ])
      expect(new TextDecoder().decode(getAddMemoInstruction("hello").data)).toBe("hello")
    }),
  )

  it.effect(
    "encodes transferChecked accounts and data",
    Effect.fn(function* () {
      const instruction = yield* getTransferCheckedInstruction({
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
    }),
  )

  it.effect(
    "derives the associated token address",
    Effect.fn(function* () {
      const [ata, bump] = yield* findAssociatedTokenPda({ owner, mint, tokenProgram })
      expect(ata).toBe("4LNjjuvNT3YkfmQhMRMBJriwsTTvNzPahTPoBEJVuA3x")
      expect(bump).toBe(255)
    }),
  )
})
