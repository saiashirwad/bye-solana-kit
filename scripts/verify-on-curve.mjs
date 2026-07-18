/**
 * Baseline: @solana/addresses 6.10.0 compressedPointBytesAreOnCurve (via isAddressOffCurve inverse)
 * Treatment: bye-solana-kit compressedPointIsOnCurve
 */
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

const require = createRequire(
  "/Users/texoport/crosshatch/crosshatch/node_modules/.pnpm/@solana+addresses@6.10.0_fastestsmallesttextencoderdecoder@1.0.22_typescript@7.0.2/node_modules/@solana/addresses/package.json",
)

// Use compiled dist so we don't need TS from solana package internals
const addressesPath =
  "/Users/texoport/crosshatch/crosshatch/node_modules/.pnpm/@solana+addresses@6.10.0_fastestsmallesttextencoderdecoder@1.0.22_typescript@7.0.2/node_modules/@solana/addresses/dist/index.node.mjs"

const solana = await import(pathToFileURL(addressesPath).href)
// isAddressOffCurve returns true when NOT on curve; invert for on-curve
// API: isAddressOffCurve(address: string) — needs base58 address
// Better: import curve from source via dynamic... dist may export isAddressOffCurve only

const { compressedPointIsOnCurve: treatment } = await import(
  "../src/Svm/_Curve.ts"
)

// Load solana curve-internal through vendor by encoding bytes as fake address?
// Read noble pointIsOnCurve by importing the curve module from dist chunks if exported.
// Fall back: use isAddressOffCurve with base58 of the 32 bytes.

function base58Encode(bytes) {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
  let n = 0n
  for (const b of bytes) n = (n << 8n) | BigInt(b)
  let enc = ""
  while (n > 0n) {
    enc = ALPHABET[Number(n % 58n)] + enc
    n /= 58n
  }
  let z = 0
  while (z < bytes.length && bytes[z] === 0) z++
  return "1".repeat(z) + enc
}

function solanaOnCurve(bytes) {
  if (bytes.byteLength !== 32) return false
  // isOffCurveAddress: true means off-curve (valid PDA material)
  if (typeof solana.isOffCurveAddress === "function") {
    return !solana.isOffCurveAddress(base58Encode(bytes))
  }
  throw new Error("isOffCurveAddress not found: " + Object.keys(solana).join(","))
}

function fromHex(h) {
  const out = new Uint8Array(h.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  return out
}

const BASE = fromHex("5866666666666666666666666666666666666666666666666666666666666666")
const ZERO = new Uint8Array(32)
const ONES = new Uint8Array(32).fill(0xff)
const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])
const rawPub = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))
const garbled = BASE.slice()
garbled[0] ^= 0xff
garbled[1] ^= 0xaa
const yOne = new Uint8Array(32)
yOne[0] = 1
const zeroOdd = new Uint8Array(32)
zeroOdd[31] = 0x80
const tokenProg = fromHex("06ddf6e1d765a193d9cbe146ceeb79ac1cb485ed5f5b37913a8cf5857eff00a9")

const vectors = [
  { name: "base_point", bytes: BASE },
  { name: "all_zero", bytes: ZERO },
  { name: "all_ff", bytes: ONES },
  { name: "webcrypto_pubkey", bytes: rawPub },
  { name: "garbled_base", bytes: garbled },
  { name: "len_31", bytes: new Uint8Array(31) },
  { name: "len_33", bytes: new Uint8Array(33) },
  { name: "y_one", bytes: yOne },
  { name: "y_zero_sign_odd", bytes: zeroOdd },
  { name: "token_program_pk", bytes: tokenProg },
]

const rows = vectors.map((v) => {
  const b = solanaOnCurve(v.bytes)
  const t = treatment(v.bytes)
  return { name: v.name, len: v.bytes.byteLength, baseline_solana: b, treatment: t, match: b === t }
})

const allMatch = rows.every((r) => r.match)
const out = {
  claim:
    "compressedPointIsOnCurve matches @solana/addresses 6.10.0 (!isAddressOffCurve) on the same vectors",
  baseline: "@solana/addresses@6.10.0 isAddressOffCurve inverted",
  treatment: "src/Svm/_Curve.ts compressedPointIsOnCurve",
  allMatch,
  rows,
}
console.log(JSON.stringify(out, null, 2))
process.exit(allMatch ? 0 : 1)
