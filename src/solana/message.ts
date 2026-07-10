import type { Address, Blockhash } from "./address.js"

export enum AccountRole {
  READONLY = 0,
  WRITABLE = 1,
  READONLY_SIGNER = 2,
  WRITABLE_SIGNER = 3,
}

export interface AccountMeta {
  readonly address: Address
  readonly role: AccountRole
}

export interface Instruction {
  readonly programAddress: Address
  readonly accounts?: ReadonlyArray<AccountMeta>
  readonly data?: Uint8Array
}

export interface TransactionMessage {
  readonly version: 0
  readonly feePayer?: Address
  readonly lifetimeConstraint?: {
    readonly blockhash: Blockhash
    readonly lastValidBlockHeight: bigint
  }
  readonly instructions: ReadonlyArray<Instruction>
}

export const createTransactionMessage = (): TransactionMessage => ({ version: 0, instructions: [] })

export const setTransactionMessageFeePayer = (feePayer: Address, message: TransactionMessage): TransactionMessage => ({
  ...message,
  feePayer,
})

export const setTransactionMessageLifetimeUsingBlockhash = (
  lifetimeConstraint: NonNullable<TransactionMessage["lifetimeConstraint"]>,
  message: TransactionMessage,
): TransactionMessage => ({ ...message, lifetimeConstraint })

export const appendTransactionMessageInstructions = (
  instructions: ReadonlyArray<Instruction>,
  message: TransactionMessage,
): TransactionMessage => ({ ...message, instructions: [...message.instructions, ...instructions] })
