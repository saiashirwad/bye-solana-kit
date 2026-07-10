import { Data } from "effect"

export class CryptoError extends Data.TaggedError("CryptoError")<{
  readonly message: string
  readonly cause?: unknown
}> {}
