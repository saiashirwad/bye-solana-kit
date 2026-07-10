import {
  address,
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
  type ProgramDerivedAddress,
} from "@solana/addresses"
import { AccountRole, type Instruction } from "@solana/instructions"

export const ASSOCIATED_TOKEN_PROGRAM_ADDRESS = address("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
export const COMPUTE_BUDGET_PROGRAM_ADDRESS = address("ComputeBudget111111111111111111111111111111")
export const MEMO_PROGRAM_ADDRESS = address("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr")

const u32le = (value: number) => {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new RangeError("Expected a u32")
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value, true)
  return bytes
}

const u64le = (value: bigint) => {
  if (value < 0n || value > 0xffffffffffffffffn) throw new RangeError("Expected a u64")
  const bytes = new Uint8Array(8)
  new DataView(bytes.buffer).setBigUint64(0, value, true)
  return bytes
}

const dataWithDiscriminator = (discriminator: number, ...fields: Uint8Array[]) => {
  const data = new Uint8Array(1 + fields.reduce((size, field) => size + field.length, 0))
  data[0] = discriminator
  let offset = 1
  for (const field of fields) {
    data.set(field, offset)
    offset += field.length
  }
  return data
}

export const getSetComputeUnitLimitInstruction = (units: number): Instruction => ({
  programAddress: COMPUTE_BUDGET_PROGRAM_ADDRESS,
  data: dataWithDiscriminator(2, u32le(units)),
})

export const getSetComputeUnitPriceInstruction = (microLamports: bigint): Instruction => ({
  programAddress: COMPUTE_BUDGET_PROGRAM_ADDRESS,
  data: dataWithDiscriminator(3, u64le(microLamports)),
})

export const getAddMemoInstruction = (memo: string): Instruction => ({
  programAddress: MEMO_PROGRAM_ADDRESS,
  accounts: [],
  data: new TextEncoder().encode(memo),
})

export interface TransferCheckedInput {
  readonly source: Address
  readonly mint: Address
  readonly destination: Address
  readonly authority: Address
  readonly tokenProgram: Address
  readonly amount: bigint
  readonly decimals: number
}

export const getTransferCheckedInstruction = (input: TransferCheckedInput): Instruction => {
  if (!Number.isInteger(input.decimals) || input.decimals < 0 || input.decimals > 255) {
    throw new RangeError("Decimals must be a u8")
  }
  return {
    programAddress: input.tokenProgram,
    accounts: [
      { address: input.source, role: AccountRole.WRITABLE },
      { address: input.mint, role: AccountRole.READONLY },
      { address: input.destination, role: AccountRole.WRITABLE },
      { address: input.authority, role: AccountRole.READONLY_SIGNER },
    ],
    data: dataWithDiscriminator(12, u64le(input.amount), Uint8Array.of(input.decimals)),
  }
}

export const findAssociatedTokenPda = (input: {
  readonly owner: Address
  readonly tokenProgram: Address
  readonly mint: Address
}): Promise<ProgramDerivedAddress> => {
  const encoder = getAddressEncoder()
  return getProgramDerivedAddress({
    programAddress: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
    seeds: [encoder.encode(input.owner), encoder.encode(input.tokenProgram), encoder.encode(input.mint)],
  })
}
