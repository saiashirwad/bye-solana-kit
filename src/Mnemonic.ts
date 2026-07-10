import { Config, Effect, flow, Redacted, Schema as S } from "effect"

export const MnemonicText = S.String.check(
  S.isPattern(
    /^(?:(?:[a-z]+ ){11}|(?:[a-z]+ ){14}|(?:[a-z]+ ){17}|(?:[a-z]+ ){20}|(?:[a-z]+ ){23})[a-z]+$/,
  ),
).pipe(S.brand("crosshatch/Mnemonic"))

export const Mnemonic = S.Redacted(MnemonicText)

export const make = flow(MnemonicText.make, Redacted.make)

export const config = flow(Config.string, Config.map(make))

export const toSeed = Effect.fnUntraced(function* (mnemonic: typeof Mnemonic.Type) {
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
