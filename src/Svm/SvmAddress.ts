import { Effect, Option, Schema as S } from "effect"

import * as CryptoKey from "../Crypto/CryptoKey.ts"
import { compressedPointIsOnCurve } from "./Curve.ts"
import { PdaOnCurveError, SvmProtocolError } from "./SvmError.ts"

export const SvmAddress = S.String.check(
  S.makeFilter(
    (value) => {
      try {
        return base58Decode(value).byteLength === 32
      } catch {
        return false
      }
    },
    { expected: "a Base58-encoded 32-byte Solana address" },
  ),
).pipe(S.brand("crosshatch/Address"), S.brand("crosshatch/SvmAddress"))

export const Blockhash = SvmAddress.pipe(S.brand("crosshatch/Blockhash"))

export type Address = typeof SvmAddress.Type
export type Blockhash = typeof Blockhash.Type
export type ProgramDerivedAddress = readonly [Address, number]

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
const ALPHABET_INDEX = new Map(
  Array.from(ALPHABET, (character, index) => [character, BigInt(index)]),
)
const PDA_MARKER = new TextEncoder().encode("ProgramDerivedAddress")

export const base58Encode = (bytes: Uint8Array): string => {
  let integer = 0n
  for (const byte of bytes) integer = (integer << 8n) | BigInt(byte)

  let encoded = ""
  while (integer > 0n) {
    encoded = ALPHABET[Number(integer % 58n)]! + encoded
    integer /= 58n
  }
  let leadingZeroes = 0
  while (leadingZeroes < bytes.length && bytes[leadingZeroes] === 0) leadingZeroes++
  return "1".repeat(leadingZeroes) + encoded
}

export const base58Decode = (value: string): Uint8Array => {
  let integer = 0n
  for (const character of value) {
    const digit = ALPHABET_INDEX.get(character)
    if (digit === undefined)
      throw new SvmProtocolError({ message: `Invalid Base58 character: ${character}` })
    integer = integer * 58n + digit
  }

  const body: number[] = []
  while (integer > 0n) {
    body.push(Number(integer & 0xffn))
    integer >>= 8n
  }
  body.reverse()
  let leadingZeroes = 0
  while (leadingZeroes < value.length && value[leadingZeroes] === "1") leadingZeroes++
  return Uint8Array.from([...new Array<number>(leadingZeroes).fill(0), ...body])
}

export const address = (value: string): Address => {
  return S.decodeUnknownSync(SvmAddress)(value)
}

export const addressFromBytes = (bytes: Uint8Array): Address => {
  if (bytes.byteLength !== 32) {
    throw new SvmProtocolError({
      message: `Solana address requires 32 bytes; got ${bytes.byteLength}`,
    })
  }
  return SvmAddress.make(base58Encode(bytes))
}

export const addressToBytes = (value: Address): Uint8Array => base58Decode(value)

export const addressFromPublicKey = (publicKey: typeof CryptoKey.CryptoKey.Type) =>
  CryptoKey.toBytes(publicKey).pipe(Effect.map((bytes) => addressFromBytes(bytes)))

const createProgramAddress = Effect.fnUntraced(function* (
  programAddress: Address,
  seeds: ReadonlyArray<Uint8Array>,
) {
  if (seeds.length > 16) {
    return yield* Effect.fail(new SvmProtocolError({ message: "A PDA supports at most 16 seeds" }))
  }
  for (const [index, seed] of seeds.entries()) {
    if (seed.byteLength > 32) {
      return yield* Effect.fail(
        new SvmProtocolError({ message: `PDA seed ${index} exceeds 32 bytes` }),
      )
    }
  }
  const seedLength = seeds.reduce((total, seed) => total + seed.byteLength, 0)
  const input = new Uint8Array(seedLength + 32 + PDA_MARKER.length)
  let offset = 0
  for (const seed of seeds) {
    input.set(seed, offset)
    offset += seed.length
  }
  input.set(addressToBytes(programAddress), offset)
  input.set(PDA_MARKER, offset + 32)
  const digest = yield* Effect.promise(() => crypto.subtle.digest("SHA-256", input)).pipe(
    Effect.map((value) => new Uint8Array(value)),
  )
  if (compressedPointIsOnCurve(digest)) return yield* Effect.fail(new PdaOnCurveError())
  return addressFromBytes(digest)
})

export const findProgramDerivedAddress = Effect.fnUntraced(function* (
  programAddress: Address,
  seeds: ReadonlyArray<Uint8Array>,
) {
  for (let bump = 255; bump > 0; bump--) {
    const candidate = yield* createProgramAddress(programAddress, [
      ...seeds,
      Uint8Array.of(bump),
    ]).pipe(
      Effect.map((value) => Option.some(value)),
      Effect.catchTag("PdaOnCurveError", () => Effect.succeed(Option.none())),
    )
    if (Option.isSome(candidate)) {
      return [candidate.value, bump] as const satisfies ProgramDerivedAddress
    }
  }
  return yield* Effect.fail(new SvmProtocolError({ message: "Unable to find a viable PDA bump" }))
})
