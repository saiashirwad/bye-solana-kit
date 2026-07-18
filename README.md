# bye-solana-kit

Zero-dep stand-in for the **narrow Solana build/sign path** Crosshatch uses today via
`@solana/kit` + `@solana-program/*`.

## Why not `partiallySignTransactionMessageWithSigners`?

Kit’s flow is awkward for Effect code:

1. `SolanaSigner` must implement kit’s **`TransactionPartialSigner`** (`signTransactions` →
   `Promise`)
2. `getTransferCheckedInstruction` takes **`authority: signer`** (the whole object), so the kit can
   later discover signers embedded in account metas
3. `partiallySignTransactionMessageWithSigners(message)` walks the message, finds those signers,
   compiles, and Promise-signs

That exists so kit can support wallets/remote signers generically. Crosshatch only ever has a local
**Ed25519 `CryptoKeyPair`** from Slip10. The clean path is explicit:

```ts
const message = buildTransactionMessage({
  feePayer: address(feePayer), // facilitator; may differ from user
  lifetimeConstraint: latestBlockhash, // { blockhash, lastValidBlockHeight }
  instructions: [
    getSetComputeUnitLimitInstruction(100_000),
    getSetComputeUnitPriceInstruction(100_000n),
    getTransferCheckedInstruction({
      source,
      mint,
      destination,
      authority: signer.address, // Address — not a signer object
      tokenProgram,
      amount: BigInt(accepted.amount),
      decimals: physical.decimals,
    }),
    ...(memo === undefined ? [] : [getAddMemoInstruction(memo)]),
  ],
})

const transaction = yield * encodeSignedTransactionMessage(message, [signer.keypair])
// → base64 wire string for the x402 payload
```

No pipe of setters, no `TransactionPartialSigner`, no MessageWithSigners.

## Preferred Crosshatch shapes (when swapping off kit)

### `SolanaSigner` — hold the keypair, not a kit interface

```ts
// today: Context.Service<…, TransactionPartialSigner>
// clean:
export class SolanaSigner extends Context.Service<
  SolanaSigner,
  {
    readonly address: Address
    readonly keypair: CryptoKeyPair // Ed25519Pair from crosshatch/Crypto
  }
>()("crosshatch/Solana/SolanaSigner") {}
```

`layerMnemonic` already builds `Ed25519Pair` — return `{ address, keypair }` and drop
`signTransactions` / `partiallySignTransaction` from `@solana/transactions`.

### `SolanaScheme` — one Effect call to wire

```ts
const signer = yield * SolanaSigner
// …
const transaction = yield * encodeSignedTransactionMessage(message, [signer.keypair])
return { transaction }
```

### RPC

Keep `createSolanaRpc` / blockhash fetch on kit or replace with raw HTTP later. This package does
**not** implement RPC.

## API map (kit → here)

| Kit / program                                                                    | Here                                                    |
| -------------------------------------------------------------------------------- | ------------------------------------------------------- |
| multi-step `createTransactionMessage` + setters + `pipe`                         | **`buildTransactionMessage({…})`**                      |
| `partiallySignTransactionMessageWithSigners` + `getBase64EncodedWireTransaction` | **`encodeSignedTransactionMessage(message, keyPairs)`** |
| `partiallySignTransaction(keyPairs, tx)`                                         | same name (Effect)                                      |
| `compileTransaction` (internal)                                                  | `compileTransaction` (for tests / inspection)           |
| `address`                                                                        | `address`                                               |
| `findAssociatedTokenPda`                                                         | same (Effect, not Promise)                              |
| compute-budget / memo / transferChecked helpers                                  | same roles; **authority is `Address`**                  |

Low-level pieces remain for tests: `compileTransaction`, `partiallySignTransaction`,
`getBase64EncodedWireTransaction`, `signTransactionMessage`.

## Source policy

| Path                                  | Policy                                               |
| ------------------------------------- | ---------------------------------------------------- |
| `src/Crypto/*` overlapping Crosshatch | **Byte copies** of `crosshatch/Crypto`               |
| `src/Svm/*`                           | Local kit/program replacements + PDA/base58          |
| `src/Mnemonic.ts`                     | Thin `toSeed` for demos/tests (Crosshatch uses `ox`) |

```sh
pnpm install && pnpm test && pnpm build && pnpm demo
```
