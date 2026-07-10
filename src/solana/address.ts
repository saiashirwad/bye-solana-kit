import { Effect } from "effect"

import { compressedPointIsOnCurve } from "./curve.js"

declare const AddressTypeId: unique symbol
export type Address = string & { readonly [AddressTypeId]: true }
export type Blockhash = Address
export type ProgramDerivedAddress = readonly [Address, number]

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
const ALPHABET_INDEX = new Map(Array.from(ALPHABET, (character, index) => [character, BigInt(index)]))
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
    if (digit === undefined) throw new Error(`Invalid Base58 character: ${character}`)
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
  const bytes = base58Decode(value)
  if (bytes.byteLength !== 32) throw new Error(`Solana address must decode to 32 bytes; got ${bytes.byteLength}`)
  return value as Address
}

export const addressFromBytes = (bytes: Uint8Array): Address => {
  if (bytes.byteLength !== 32) throw new Error(`Solana address requires 32 bytes; got ${bytes.byteLength}`)
  return base58Encode(bytes) as Address
}

export const addressToBytes = (value: Address): Uint8Array => base58Decode(value)

export const addressFromPublicKey = (publicKey: CryptoKey) =>
  Effect.promise(() => crypto.subtle.exportKey("raw", publicKey)).pipe(
    Effect.map((bytes) => addressFromBytes(new Uint8Array(bytes))),
  )

const createProgramAddress = async (programAddress: Address, seeds: ReadonlyArray<Uint8Array>): Promise<Address> => {
  if (seeds.length > 16) throw new RangeError("A PDA supports at most 16 seeds")
  const seedLength = seeds.reduce((total, seed, index) => {
    if (seed.byteLength > 32) throw new RangeError(`PDA seed ${index} exceeds 32 bytes`)
    return total + seed.byteLength
  }, 0)
  const input = new Uint8Array(seedLength + 32 + PDA_MARKER.length)
  let offset = 0
  for (const seed of seeds) {
    input.set(seed, offset)
    offset += seed.length
  }
  input.set(addressToBytes(programAddress), offset)
  input.set(PDA_MARKER, offset + 32)
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input))
  if (compressedPointIsOnCurve(digest)) throw new Error("PDA is on the Ed25519 curve")
  return addressFromBytes(digest)
}

export const findProgramDerivedAddress = async (
  programAddress: Address,
  seeds: ReadonlyArray<Uint8Array>,
): Promise<ProgramDerivedAddress> => {
  for (let bump = 255; bump > 0; bump--) {
    try {
      return [await createProgramAddress(programAddress, [...seeds, Uint8Array.of(bump)]), bump]
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "PDA is on the Ed25519 curve") throw error
    }
  }
  throw new Error("Unable to find a viable PDA bump")
}
