# bye-solana-kit

Standalone proof-of-concept for building and signing the Crosshatch Solana transfer without:

- `@solana/kit`
- `@solana/signers`
- `@solana-program/*`

It uses focused Solana packages for addresses, instruction types, transaction messages, and transaction serialization. The five program-specific helpers used by Crosshatch are implemented locally.

```sh
pnpm install
pnpm test
pnpm build
pnpm demo
```

The demo creates and signs a transaction locally; it does not submit it to a network.
