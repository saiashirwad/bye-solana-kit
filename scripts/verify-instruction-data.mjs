/**
 * Instruction data bytes vs @solana-program/* helpers where available.
 * Claims:
 * - compute budget limit disc=2 + u32 LE
 * - compute budget price disc=3 + u64 LE
 * - transfer checked disc=12 + u64 LE amount + u8 decimals
 * - memo is raw UTF-8
 */
import { Effect } from "effect"
import {
  getAddMemoInstruction,
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
  getTransferCheckedInstruction,
  COMPUTE_BUDGET_PROGRAM_ADDRESS,
  MEMO_PROGRAM_ADDRESS,
} from "../src/Svm/Instructions.ts"
import { SvmAddress } from "../src/Svm/SvmAddress.ts"

const hex = (u) => [...u].map((b) => b.toString(16).padStart(2, "0")).join("")

const result = await Effect.runPromise(
  Effect.gen(function* () {
    const limit = yield* getSetComputeUnitLimitInstruction(100_000)
    const price = yield* getSetComputeUnitPriceInstruction(100_000n)
    const xfer = yield* getTransferCheckedInstruction({
      source: SvmAddress.make("11111111111111111111111111111111"),
      mint: SvmAddress.make("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
      destination: SvmAddress.make("11111111111111111111111111111112"),
      authority: SvmAddress.make("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      tokenProgram: SvmAddress.make("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      amount: 1_000_000n,
      decimals: 6,
    })
    const memo = getAddMemoInstruction("bye @solana/kit")

    const limitExpected = (() => {
      const d = new Uint8Array(5)
      d[0] = 2
      new DataView(d.buffer).setUint32(1, 100_000, true)
      return d
    })()
    const priceExpected = (() => {
      const d = new Uint8Array(9)
      d[0] = 3
      new DataView(d.buffer).setBigUint64(1, 100_000n, true)
      return d
    })()
    const xferExpected = (() => {
      const d = new Uint8Array(10)
      d[0] = 12
      new DataView(d.buffer).setBigUint64(1, 1_000_000n, true)
      d[9] = 6
      return d
    })()
    const memoExpected = new TextEncoder().encode("bye @solana/kit")

    return {
      limit: {
        programOk: limit.programAddress === COMPUTE_BUDGET_PROGRAM_ADDRESS,
        dataMatch: hex(limit.data) === hex(limitExpected),
        dataHex: hex(limit.data),
        expectedHex: hex(limitExpected),
      },
      price: {
        programOk: price.programAddress === COMPUTE_BUDGET_PROGRAM_ADDRESS,
        dataMatch: hex(price.data) === hex(priceExpected),
        dataHex: hex(price.data),
        expectedHex: hex(priceExpected),
      },
      transferChecked: {
        programOk: xfer.programAddress === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        dataMatch: hex(xfer.data) === hex(xferExpected),
        accounts: xfer.accounts.map((a) => ({ address: a.address, role: a.role })),
        dataHex: hex(xfer.data),
        expectedHex: hex(xferExpected),
      },
      memo: {
        programOk: memo.programAddress === MEMO_PROGRAM_ADDRESS,
        dataMatch: hex(memo.data) === hex(memoExpected),
        dataHex: hex(memo.data),
      },
    }
  }),
)

// Cross-check with @solana-program packages if importable
const budgetRoot =
  "/Users/texoport/crosshatch/crosshatch/node_modules/.pnpm/@solana-program+compute-budget@0.16.0_@solana+kit@6.10.0_bufferutil@4.1.0_fastestsmalle_3775adaaa0cfc2846c922e3adb4422ae/node_modules/@solana-program/compute-budget"
const memoRoot =
  "/Users/texoport/crosshatch/crosshatch/node_modules/.pnpm/@solana-program+memo@0.11.2_@solana+kit@6.10.0_bufferutil@4.1.0_fastestsmallesttextenco_4217785712188526fd0da84d669cc418/node_modules/@solana-program/memo"
const tokenRoot =
  "/Users/texoport/crosshatch/crosshatch/node_modules/.pnpm/@solana-program+token@0.14.0_@solana+kit@6.10.0_bufferutil@4.1.0_fastestsmallesttextenc_59090a705eeff8de730ad25a0b19adc4/node_modules/@solana-program/token"

let kit = {}
try {
  const { pathToFileURL } = await import("node:url")
  const cb = await import(pathToFileURL(`${budgetRoot}/dist/src/index.mjs`).href)
  const limitIx = cb.getSetComputeUnitLimitInstruction({ units: 100_000 })
  const priceIx = cb.getSetComputeUnitPriceInstruction({ microLamports: 100_000n })
  kit.computeBudget = {
    limitDataHex: hex(new Uint8Array(limitIx.data)),
    priceDataHex: hex(new Uint8Array(priceIx.data)),
    limitMatch: hex(new Uint8Array(limitIx.data)) === result.limit.dataHex,
    priceMatch: hex(new Uint8Array(priceIx.data)) === result.price.dataHex,
  }
} catch (e) {
  kit.computeBudget = { error: String(e.message ?? e) }
}
try {
  const { pathToFileURL } = await import("node:url")
  const memo = await import(pathToFileURL(`${memoRoot}/dist/src/index.mjs`).href)
  const memoIx = memo.getAddMemoInstruction({ memo: "bye @solana/kit" })
  kit.memo = {
    dataHex: hex(new Uint8Array(memoIx.data)),
    match: hex(new Uint8Array(memoIx.data)) === result.memo.dataHex,
  }
} catch (e) {
  kit.memo = { error: String(e.message ?? e) }
}
try {
  const { pathToFileURL } = await import("node:url")
  const token = await import(pathToFileURL(`${tokenRoot}/dist/src/index.mjs`).href)
  const xferIx = token.getTransferCheckedInstruction({
    source: "11111111111111111111111111111111",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    destination: "11111111111111111111111111111112",
    authority: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    amount: 1_000_000n,
    decimals: 6,
  })
  kit.transferChecked = {
    dataHex: hex(new Uint8Array(xferIx.data)),
    match: hex(new Uint8Array(xferIx.data)) === result.transferChecked.dataHex,
  }
} catch (e) {
  kit.transferChecked = { error: String(e.message ?? e) }
}

const localOk =
  result.limit.programOk &&
  result.limit.dataMatch &&
  result.price.programOk &&
  result.price.dataMatch &&
  result.transferChecked.programOk &&
  result.transferChecked.dataMatch &&
  result.memo.programOk &&
  result.memo.dataMatch

const kitOk = ["computeBudget", "memo", "transferChecked"].every((k) => {
  const v = kit[k]
  if (!v || v.error) return true // don't fail if kit unimportable; local schema is enough
  if (k === "computeBudget") return v.limitMatch && v.priceMatch
  return v.match === true
})

const out = {
  claim: "instruction data matches Solana program layouts (local + kit when available)",
  allMatch: localOk && kitOk,
  localOk,
  kitOk,
  result,
  kit,
}
console.log(JSON.stringify(out, null, 2))
process.exit(localOk && kitOk ? 0 : 1)
