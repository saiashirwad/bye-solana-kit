# bye-solana-kit

Standalone proof-of-concept for building and signing the Crosshatch Solana transfer without:

- `@solana/kit`
- `@solana/signers`
- `@solana-program/*`

It has no `@solana/*` dependencies. It locally implements the narrow protocol surface Crosshatch uses:

- Base58 addresses and PDA derivation
- Version-0 messages with static accounts and a blockhash lifetime
- Instruction account ordering and wire encoding
- Local WebCrypto Ed25519 signing and Base64 transaction serialization
- The five program-specific helpers used by Crosshatch

It intentionally does not implement lookup tables, durable nonces, legacy messages, remote signers, or RPC clients.

```sh
pnpm install
pnpm test
pnpm build
pnpm demo
```

The demo creates and signs a transaction locally; it does not submit it to a network.
