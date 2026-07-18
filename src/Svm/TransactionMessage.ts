import type { Address, Blockhash } from "./SvmAddress.ts"

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

export interface LifetimeConstraint {
  readonly blockhash: Blockhash
  /** Not on the wire; kept for kit-shaped blockhash responses. */
  readonly lastValidBlockHeight: bigint
}

export interface TransactionMessage {
  readonly version: 0
  readonly feePayer: Address
  readonly lifetimeConstraint: LifetimeConstraint
  readonly instructions: ReadonlyArray<Instruction>
}

/**
 * Preferred message constructor — one object, no kit pipe / multi-step setters.
 *
 * Replaces the kit dance of:
 *   pipe(createTransactionMessage({ version: 0 }), setFeePayer, setLifetime, appendIxs)
 */
export const buildTransactionMessage = (input: {
  readonly feePayer: Address
  readonly lifetimeConstraint: LifetimeConstraint
  readonly instructions: ReadonlyArray<Instruction>
}): TransactionMessage => ({
  version: 0,
  feePayer: input.feePayer,
  lifetimeConstraint: input.lifetimeConstraint,
  instructions: input.instructions,
})
