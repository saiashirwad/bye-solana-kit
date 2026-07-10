import { Effect } from "effect"

/** BIP-39 mnemonic-to-seed derivation. Word-list validation belongs at the input boundary. */
export const toSeed = (mnemonic: string, passphrase = "") =>
  Effect.gen(function* () {
    const encoder = new TextEncoder()
    const password = encoder.encode(mnemonic.normalize("NFKD"))
    const salt = encoder.encode(`mnemonic${passphrase.normalize("NFKD")}`)
    const key = yield* Effect.promise(() =>
      crypto.subtle.importKey("raw", password, "PBKDF2", false, ["deriveBits"]),
    )
    const seed = yield* Effect.promise(() =>
      crypto.subtle.deriveBits(
        { name: "PBKDF2", hash: "SHA-512", iterations: 2048, salt },
        key,
        512,
      ),
    )
    return new Uint8Array(seed)
  })
