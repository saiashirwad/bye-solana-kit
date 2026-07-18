# bye-solana-kit

Zero-dep stand-in for the Solana build/sign path Crosshatch uses via `@solana/kit` +
`@solana-program/*`.

## Style (Crosshatch)

- One concept per file, PascalCase; folder barrels `export * as X from "./X.ts"`
- Consumers import barrels (`Crypto/Crypto.ts`, `Svm/Svm.ts`); `_`-files stay private
- Tests colocated as `X.test.ts`
- `Schema as S`; multi-step work is `Effect.fnUntraced`; **nothing throws** — Schema / `Effect.fail`
  / `yield* new TaggedError`
- Crypto modules are **byte copies** of `crosshatch/Crypto` (minus unused Cek/X25519)

## Clean API (vs kit MessageWithSigners)

```ts
import { Ed25519Pair, Slip10 } from "./Crypto/Crypto.ts"
import { Instructions, SvmAddress, Transaction, TransactionMessage } from "./Svm/Svm.ts"

const transaction =
  yield *
  Transaction.encodeSignedTransactionMessage(
    TransactionMessage.buildTransactionMessage({
      feePayer,
      lifetimeConstraint: latestBlockhash,
      instructions: [
        yield * Instructions.getSetComputeUnitLimitInstruction(100_000),
        yield * Instructions.getSetComputeUnitPriceInstruction(100_000n),
        yield *
          Instructions.getTransferCheckedInstruction({
            source,
            mint,
            destination,
            authority: signerAddress, // Address, not a signer object
            tokenProgram,
            amount,
            decimals,
          }),
        ...(memo === undefined ? [] : [Instructions.getAddMemoInstruction(memo)]),
      ],
    }),
    [keypair],
  )
```

## Layout

```
src/
  Crypto/          # Crosshatch copies + Crypto.ts barrel + Crypto.test.ts
  Mnemonic.ts      # thin BIP-39 seed helper (tests)
  Svm/
    Svm.ts         # barrel
    _Curve.ts      # private PDA on-curve check
    SvmAddress.ts / Instructions.ts / Transaction*.ts / SvmError.ts
    *.test.ts
```

```sh
pnpm install && pnpm test && pnpm build
```
