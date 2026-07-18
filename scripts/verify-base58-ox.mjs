/**
 * Optional parity: hand-rolled base58 vs ox Base58 (what Crosshatch uses).
 * Documents any intentional differences (e.g. leading-zero length).
 */
import { Option } from "effect"
import { Base58 } from "file:///Users/texoport/crosshatch/crosshatch/node_modules/.pnpm/ox@0.10.6_typescript@7.0.2_zod@3.25.76/node_modules/ox/_esm/index.js"
import { base58Decode, base58Encode, addressToBytes, SvmAddress } from "../src/Svm/SvmAddress.ts"

function hex(u8) {
  return [...u8].map((b) => b.toString(16).padStart(2, "0")).join("")
}

const vectors = [
  { name: "32_zeros", bytes: new Uint8Array(32) },
  { name: "32_ones", bytes: new Uint8Array(32).fill(1) },
  { name: "token_prog", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
  { name: "usdc", address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
  { name: "system12", address: "11111111111111111111111111111112" },
  { name: "compute_budget", address: "ComputeBudget111111111111111111111111111111" },
  { name: "atoken", address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL" },
  {
    name: "random32",
    bytes: Uint8Array.from({ length: 32 }, (_, i) => (i * 37 + 11) & 0xff),
  },
]

const rows = []
for (const v of vectors) {
  if (v.bytes) {
    const ours = base58Encode(v.bytes)
    const ox = Base58.fromBytes(v.bytes)
    const oxRound = Base58.toBytes(ox)
    const ourRound = Option.getOrThrow(base58Decode(ours))
    rows.push({
      name: v.name,
      ours,
      ox,
      encodeMatch: ours === ox,
      ourLen: ours.length,
      oxLen: ox.length,
      ourRoundtrip: hex(ourRound) === hex(v.bytes),
      oxRoundtrip: hex(oxRound) === hex(v.bytes),
      oxRoundLen: oxRound.length,
      ourRoundLen: ourRound.length,
    })
  } else {
    const ourDec = Option.getOrThrow(base58Decode(v.address))
    const oxDec = Base58.toBytes(v.address)
    const ourEnc = base58Encode(ourDec)
    const oxEnc = Base58.fromBytes(oxDec)
    const atb = addressToBytes(SvmAddress.make(v.address))
    rows.push({
      name: v.name,
      address: v.address,
      decodeMatch: hex(ourDec) === hex(oxDec),
      reencodeOurs: ourEnc === v.address,
      reencodeOx: oxEnc === v.address,
      addressToBytesMatch: hex(atb) === hex(ourDec),
      ourHex: hex(ourDec),
      oxHex: hex(oxDec),
    })
  }
}

const encodeAllMatch = rows.filter((r) => "encodeMatch" in r).every((r) => r.encodeMatch)
const decodeAllMatch = rows.filter((r) => "decodeMatch" in r).every((r) => r.decodeMatch)
// Solana system program string uses 32 ones — check both libs
const systemStr = "11111111111111111111111111111111"
const systemOur = base58Encode(new Uint8Array(32))
const systemOx = Base58.fromBytes(new Uint8Array(32))

const out = {
  claim: "hand-rolled base58 matches ox Base58 on Solana address vectors",
  allMatch: encodeAllMatch && decodeAllMatch && systemOur === systemStr,
  encodeAllMatch,
  decodeAllMatch,
  systemProgram: {
    expected: systemStr,
    ours: systemOur,
    ox: systemOx,
    oursOk: systemOur === systemStr,
    oxOk: systemOx === systemStr,
    oursLen: systemOur.length,
    oxLen: systemOx.length,
  },
  rows,
}
console.log(JSON.stringify(out, null, 2))
// Exit 0 only if treatment matches Solana expectation AND ox for non-leading-zero cases;
// if ox diverges on zeros, still report clearly
const solanaCriticalOk = systemOur === systemStr && decodeAllMatch
const oxParityOk = encodeAllMatch && decodeAllMatch
process.exit(solanaCriticalOk && oxParityOk ? 0 : solanaCriticalOk ? 2 : 1)
