import { Effect, Redacted, Schema as S } from "effect"

// Minimal BIP-39 seed helper for demos/tests.
// Crosshatch uses `ox` Mnemonic.toSeed at Solana call sites; this avoids that dep.

export const MnemonicText = S.String.check(
  S.isPattern(
    /^(?:(?:[a-z]+ ){11}|(?:[a-z]+ ){14}|(?:[a-z]+ ){17}|(?:[a-z]+ ){20}|(?:[a-z]+ ){23})[a-z]+$/u,
  ),
).pipe(S.brand("crosshatch/Mnemonic"))

export const fromText = (text: string) => Redacted.make(MnemonicText.make(text))

export type Mnemonic = ReturnType<typeof fromText>

export const toSeed = Effect.fnUntraced(function* (mnemonic: Mnemonic) {
  const encoder = new TextEncoder()
  const password = encoder.encode(Redacted.value(mnemonic).normalize("NFKD"))
  const salt = encoder.encode("mnemonic")
  const key = yield* Effect.promise(() =>
    crypto.subtle.importKey("raw", password, "PBKDF2", false, ["deriveBits"]),
  )
  const seed = yield* Effect.promise(() =>
    crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-512", iterations: 2048, salt }, key, 512),
  )
  return new Uint8Array(seed)
})
