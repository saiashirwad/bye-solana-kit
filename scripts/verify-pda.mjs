/**
 * Baseline: @solana/addresses getProgramDerivedAddress
 * Treatment: bye-solana-kit findProgramDerivedAddress
 */
import { pathToFileURL } from "node:url"
import { Effect } from "effect"
import {
  addressToBytes,
  findProgramDerivedAddress,
  SvmAddress,
} from "../src/Svm/SvmAddress.ts"

const addressesPath =
  "/Users/texoport/crosshatch/crosshatch/node_modules/.pnpm/@solana+addresses@6.10.0_fastestsmallesttextencoderdecoder@1.0.22_typescript@7.0.2/node_modules/@solana/addresses/dist/index.node.mjs"

const solana = await import(pathToFileURL(addressesPath).href)

const cases = [
  {
    name: "empty_seeds_system_prog",
    program: "11111111111111111111111111111111",
    seeds: [],
  },
  {
    name: "single_seed_token_prog",
    program: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    seeds: [new TextEncoder().encode("hello")],
  },
  {
    name: "ata_style_seeds",
    program: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
    seeds: [
      addressToBytes(SvmAddress.make("11111111111111111111111111111112")),
      addressToBytes(SvmAddress.make("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")),
      addressToBytes(SvmAddress.make("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")),
    ],
  },
  {
    name: "memo_prog_two_seeds",
    program: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
    seeds: [new Uint8Array([1, 2, 3]), new Uint8Array(32).fill(7)],
  },
  {
    name: "empty_seeds_token",
    program: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    seeds: [],
  },
]

const rows = []
for (const c of cases) {
  const [baseAddr, baseBump] = await solana.getProgramDerivedAddress({
    programAddress: c.program,
    seeds: c.seeds,
  })
  const treatment = await Effect.runPromise(
    findProgramDerivedAddress(SvmAddress.make(c.program), c.seeds),
  )
  const match = treatment[0] === baseAddr && treatment[1] === baseBump
  rows.push({
    name: c.name,
    baseline: { address: baseAddr, bump: baseBump },
    treatment: { address: treatment[0], bump: treatment[1] },
    match,
  })
}

const allMatch = rows.every((r) => r.match)
const out = {
  claim:
    "findProgramDerivedAddress matches @solana/addresses getProgramDerivedAddress (address+bump)",
  baseline: "@solana/addresses@6.10.0 getProgramDerivedAddress",
  treatment: "src/Svm/SvmAddress.ts findProgramDerivedAddress",
  allMatch,
  rows,
}
console.log(JSON.stringify(out, null, 2))
process.exit(allMatch ? 0 : 1)
