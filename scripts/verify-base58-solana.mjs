/**
 * Baseline: @solana/addresses getAddressEncoder/Decoder (Solana's codec)
 * Treatment: hand-rolled base58 in SvmAddress
 */
import { pathToFileURL } from "node:url"
import { Option } from "effect"
import { base58Decode, base58Encode, addressToBytes, SvmAddress } from "../src/Svm/SvmAddress.ts"

const addressesPath =
  "/Users/texoport/crosshatch/crosshatch/node_modules/.pnpm/@solana+addresses@6.10.0_fastestsmallesttextencoderdecoder@1.0.22_typescript@7.0.2/node_modules/@solana/addresses/dist/index.node.mjs"
const solana = await import(pathToFileURL(addressesPath).href)
const enc = solana.getAddressEncoder()
const dec = solana.getAddressDecoder()

const hex = (u) => [...u].map((b) => b.toString(16).padStart(2, "0")).join("")

const vectors = [
  { name: "system", address: "11111111111111111111111111111111" },
  { name: "system12", address: "11111111111111111111111111111112" },
  { name: "token", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
  { name: "usdc", address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
  { name: "compute", address: "ComputeBudget111111111111111111111111111111" },
  { name: "atoken", address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL" },
  { name: "memo", address: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr" },
  { name: "wsol", address: "So11111111111111111111111111111111111111112" },
]

const rows = []
for (const v of vectors) {
  const solBytes = new Uint8Array(enc.encode(v.address))
  const ourBytes = Option.getOrThrow(base58Decode(v.address))
  const solAddr = dec.decode(solBytes)
  const ourAddr = base58Encode(solBytes)
  const atb = addressToBytes(SvmAddress.make(v.address))
  rows.push({
    name: v.name,
    address: v.address,
    decodeMatch: hex(solBytes) === hex(ourBytes),
    encodeFromSolBytesMatch: ourAddr === solAddr && ourAddr === v.address,
    addressToBytesMatch: hex(atb) === hex(solBytes),
    solHex: hex(solBytes),
  })
}

// zeros encode
const zeros = new Uint8Array(32)
const ourZero = base58Encode(zeros)
const solZero = dec.decode(zeros)

const allMatch =
  rows.every((r) => r.decodeMatch && r.encodeFromSolBytesMatch && r.addressToBytesMatch) &&
  ourZero === "11111111111111111111111111111111" &&
  solZero === ourZero

const out = {
  claim: "base58 matches @solana/addresses codec on known Solana addresses + 32 zero bytes",
  allMatch,
  systemZeros: { ours: ourZero, solana: solZero, match: ourZero === solZero },
  rows,
}
console.log(JSON.stringify(out, null, 2))
process.exit(allMatch ? 0 : 1)
