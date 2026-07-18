/**
 * Baseline: @solana/addresses getProgramDerivedAddress with ATA seeds
 *          + @solana-program/token findAssociatedTokenPda when importable
 * Treatment: bye-solana-kit findAssociatedTokenPda
 */
import { pathToFileURL } from "node:url"
import { Effect } from "effect"
import { findAssociatedTokenPda, ASSOCIATED_TOKEN_PROGRAM_ADDRESS } from "../src/Svm/Instructions.ts"
import { SvmAddress } from "../src/Svm/SvmAddress.ts"

const addressesPath =
  "/Users/texoport/crosshatch/crosshatch/node_modules/.pnpm/@solana+addresses@6.10.0_fastestsmallesttextencoderdecoder@1.0.22_typescript@7.0.2/node_modules/@solana/addresses/dist/index.node.mjs"
const solana = await import(pathToFileURL(addressesPath).href)

const tokenRoot =
  "/Users/texoport/crosshatch/crosshatch/node_modules/.pnpm/@solana-program+token@0.14.0_@solana+kit@6.10.0_bufferutil@4.1.0_fastestsmallesttextenc_59090a705eeff8de730ad25a0b19adc4/node_modules/@solana-program/token"
let kitFindAta = null
try {
  const token = await import(pathToFileURL(`${tokenRoot}/dist/src/index.mjs`).href)
  kitFindAta = token.findAssociatedTokenPda
} catch (e) {
  // resolve via kit path dependency graph can fail outside monorepo; PDA seeds baseline still valid
}

const cases = [
  {
    name: "system12_usdc_tokenkeg",
    owner: "11111111111111111111111111111112",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    tokenProgram: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  },
  {
    name: "system_usdc_tokenkeg",
    owner: "11111111111111111111111111111111",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    tokenProgram: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  },
  {
    name: "token_prog_as_owner",
    owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    mint: "So11111111111111111111111111111111111111112",
    tokenProgram: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  },
]

const enc = solana.getAddressEncoder()
const rows = []
for (const c of cases) {
  const [baseAddr, baseBump] = await solana.getProgramDerivedAddress({
    programAddress: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
    seeds: [enc.encode(c.owner), enc.encode(c.tokenProgram), enc.encode(c.mint)],
  })

  const treatment = await Effect.runPromise(
    findAssociatedTokenPda({
      owner: SvmAddress.make(c.owner),
      mint: SvmAddress.make(c.mint),
      tokenProgram: SvmAddress.make(c.tokenProgram),
    }),
  )

  let kit = null
  if (kitFindAta) {
    try {
      const [kAddr, kBump] = await kitFindAta({
        owner: c.owner,
        mint: c.mint,
        tokenProgram: c.tokenProgram,
      })
      kit = { address: kAddr, bump: kBump }
    } catch (e) {
      kit = { error: String(e) }
    }
  }

  const matchAddresses =
    treatment[0] === baseAddr &&
    treatment[1] === baseBump &&
    (kit === null || kit.error || (kit.address === treatment[0] && kit.bump === treatment[1]))

  rows.push({
    name: c.name,
    baseline_addresses: { address: baseAddr, bump: baseBump },
    treatment: { address: treatment[0], bump: treatment[1] },
    kit_findAssociatedTokenPda: kit,
    atoken_program: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
    match: matchAddresses && treatment[0] === baseAddr,
  })
}

const allMatch = rows.every((r) => r.match)
const out = {
  claim:
    "findAssociatedTokenPda matches getProgramDerivedAddress(AToken, [owner, tokenProgram, mint])",
  allMatch,
  rows,
}
console.log(JSON.stringify(out, null, 2))
process.exit(allMatch ? 0 : 1)
