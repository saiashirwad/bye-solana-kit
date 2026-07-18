# bye-solana-kit

Zero-dep stand-in for the **exact `@solana/*` / `@solana-program/*` surface Crosshatch touches**
when building and partially signing its Solana payment transaction.

## Crosshatch kit inventory (control-flow sourced)

From `crosshatch/Solana/{SolanaScheme,SolanaSigner,SolanaState,SolanaAddress}.ts`:

| Package                          | Symbols used                                                                                                                                                                                                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@solana/addresses`              | `address`, `Address`                                                                                                                                                                                                                                                         |
| `@solana/kit`                    | `createTransactionMessage`, `setTransactionMessageFeePayer`, `setTransactionMessageLifetimeUsingBlockhash`, `appendTransactionMessageInstructions`, `partiallySignTransactionMessageWithSigners`, `getBase64EncodedWireTransaction`, `pipe`, `Blockhash`, `createSolanaRpc`† |
| `@solana/transactions`           | `partiallySignTransaction`                                                                                                                                                                                                                                                   |
| `@solana-program/compute-budget` | `getSetComputeUnitLimitInstruction`, `getSetComputeUnitPriceInstruction`                                                                                                                                                                                                     |
| `@solana-program/memo`           | `getAddMemoInstruction`                                                                                                                                                                                                                                                      |
| `@solana-program/token`          | `findAssociatedTokenPda`, `getTransferCheckedInstruction`                                                                                                                                                                                                                    |

† **Not implemented:** `createSolanaRpc` / RPC (network). Crosshatch can keep kit only for RPC or
call HTTP itself. Everything needed to **build + partial-sign + base64 wire** is here.

`partiallySignTransactionMessageWithSigners` is replaced by the explicit kit pair:

1. `compileTransaction(message)`
2. `partiallySignTransaction([keypair], transaction)` — same shape as `@solana/transactions`

## Source policy

| Path                                    | Policy                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/Crypto/*` that exist in Crosshatch | **Byte copies** of `crosshatch/Crypto` (Ed25519, Slip10, Hmac, CryptoKey)             |
| `src/Svm/*`                             | Minimal local implementations of the kit/program symbols above + PDA/base58 they need |
| `src/Mnemonic.ts`                       | Thin `toSeed` only (Crosshatch uses `ox`; not kit surface)                            |
| Product wrappers                        | **Removed** — no `SvmSigner`, no Boundary, no Scheme/State/Layers                     |

## Layout

```
src/
  Crypto/          # Crosshatch copies (WebCrypto key material for signing)
  Mnemonic.ts      # BIP-39 seed helper for demos/tests
  Svm/
    SvmAddress.ts  # address, base58, PDA (supports findAssociatedTokenPda)
    Curve.ts       # on-curve check for PDA
    Instructions.ts
    TransactionMessage.ts
    Transaction.ts # compile + partiallySignTransaction + getBase64EncodedWireTransaction
    SvmError.ts
  Demo.ts
```

```sh
pnpm install
pnpm test
pnpm build
pnpm demo
```

Demo signs locally; it does not submit to a network.
