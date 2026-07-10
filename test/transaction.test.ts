import { Effect, Encoding, pipe } from "effect"
import { describe, expect, it } from "vitest"

import {
  findAssociatedTokenPda,
  getAddMemoInstruction,
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
  getTransferCheckedInstruction,
} from "../src/solana/instructions.js"
import { address } from "../src/solana/address.js"
import {
  appendTransactionMessageInstructions,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from "../src/solana/message.js"
import { compileTransaction, getBase64EncodedWireTransaction } from "../src/solana/transaction.js"
import { signerFromMnemonic } from "../src/signer.js"

const MNEMONIC = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
const EXPECTED_MESSAGE = "8001000407f036276246a75b9de3349ed42b15e232f6518fc20f5fcd4f1d64e81f9bd258f740d2f27c461f29e9feba1ab8acd39496a9c65b0ae62a713f01f941a993bf55ede12a7fb50cfedeed6b9226f35852ddf1b5a96e18061b7901a72f4d768d870d6d0306466fe5211732ffecadba72c39be7bc8ce5bbc5f7126b2c439b3a40000000c6fa7af3bedbad3a3d65f36aabc97431b1bbe4c2d2f6e0e47ca60203452f5d61054a535a992921064d24e87160da387c7c35b5ddbc92bb81e41fa8404105448d06ddf6e1d765a193d9cbe146ceeb79ac1cb485ed5f5b37913a8cf5857eff00a900000000000000000000000000000000000000000000000000000000000000000403000502a086010003000903a0860100000000000604010402000a0c40420f00000000000605000f6279652040736f6c616e612f6b697400"
const EXPECTED_WIRE = "AVeiNwKp+gpOWJqIaiQRCzJrzVonIg19z/w1z5MPCDXd0e80DjYhzfHP1puSAh87mrSxS5cxpAwX7A47uJCnYgeAAQAEB/A2J2JGp1ud4zSe1CsV4jL2UY/CD1/NTx1k6B+b0lj3QNLyfEYfKen+uhq4rNOUlqnGWwrmKnE/AflBqZO/Ve3hKn+1DP7e7WuSJvNYUt3xtaluGAYbeQGnL012jYcNbQMGRm/lIRcy/+ytunLDm+e8jOW7xfcSayxDmzpAAAAAxvp6877brTo9ZfNqq8l0MbG75MLS9uDkfKYCA0UvXWEFSlNamSkhBk0k6HFg2jh8fDW13bySu4HkH6hAQQVEjQbd9uHXZaGT2cvhRs7reawctIXtX1s3kTqM9YV+/wCpAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAwAFAqCGAQADAAkDoIYBAAAAAAAGBAEEAgAKDEBCDwAAAAAABgUAD2J5ZSBAc29sYW5hL2tpdAA="
const EXPECTED_PARTIAL_MESSAGE = "80020102060000000000000000000000000000000000000000000000000000000000000001f036276246a75b9de3349ed42b15e232f6518fc20f5fcd4f1d64e81f9bd258f740d2f27c461f29e9feba1ab8acd39496a9c65b0ae62a713f01f941a993bf55ede12a7fb50cfedeed6b9226f35852ddf1b5a96e18061b7901a72f4d768d870d6dc6fa7af3bedbad3a3d65f36aabc97431b1bbe4c2d2f6e0e47ca60203452f5d6106ddf6e1d765a193d9cbe146ceeb79ac1cb485ed5f5b37913a8cf5857eff00a90000000000000000000000000000000000000000000000000000000000000000010504020403010a0c40420f00000000000600"
const EXPECTED_PARTIAL_WIRE = "AgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABdpofOnF+WXRHTLgORfr6eRXhIzISi0OXvXKX5GW/b2/zbHIcpYUUugHPk3Qw4+ILnX2/joiuMe7EsFS6XbOgGgAIBAgYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAfA2J2JGp1ud4zSe1CsV4jL2UY/CD1/NTx1k6B+b0lj3QNLyfEYfKen+uhq4rNOUlqnGWwrmKnE/AflBqZO/Ve3hKn+1DP7e7WuSJvNYUt3xtaluGAYbeQGnL012jYcNbcb6evO+2606PWXzaqvJdDGxu+TC0vbg5HymAgNFL11hBt324ddloZPZy+FGzut5rBy0he1fWzeROoz1hX7/AKkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEFBAIEAwEKDEBCDwAAAAAABgA="

const makeTransaction = Effect.gen(function* () {
  const signer = yield* signerFromMnemonic(MNEMONIC)
  const mint = address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
  const recipient = address("11111111111111111111111111111112")
  const tokenProgram = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
  const [[source], [destination]] = yield* Effect.all([
    Effect.promise(() => findAssociatedTokenPda({ owner: signer.address, mint, tokenProgram })),
    Effect.promise(() => findAssociatedTokenPda({ owner: recipient, mint, tokenProgram })),
  ])
  const message = pipe(
    createTransactionMessage(),
    (value) => setTransactionMessageFeePayer(signer.address, value),
    (value) => setTransactionMessageLifetimeUsingBlockhash({
      blockhash: address("11111111111111111111111111111111"),
      lastValidBlockHeight: 1n,
    }, value),
    (value) => appendTransactionMessageInstructions([
      getSetComputeUnitLimitInstruction(100_000),
      getSetComputeUnitPriceInstruction(100_000n),
      getTransferCheckedInstruction({
        source,
        mint,
        destination,
        authority: signer.address,
        tokenProgram,
        amount: 1_000_000n,
        decimals: 6,
      }),
      getAddMemoInstruction("bye @solana/kit"),
    ], value),
  )
  return { signer, transaction: compileTransaction(message) }
})

describe("local v0 transaction protocol", () => {
  it("matches the official compiled-message and wire fixtures byte-for-byte", async () => {
    const { signer, transaction } = await Effect.runPromise(makeTransaction)
    expect(signer.address).toBe("HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk")
    expect(Object.keys(transaction.signatures)).toEqual([signer.address])
    expect(Encoding.encodeHex(transaction.messageBytes)).toBe(EXPECTED_MESSAGE)
    const signed = await Effect.runPromise(signer.signTransaction(transaction))
    expect(getBase64EncodedWireTransaction(signed)).toBe(EXPECTED_WIRE)
  })

  it("rejects a signer that is not required by the transaction", async () => {
    const signer = await Effect.runPromise(signerFromMnemonic(MNEMONIC))
    const message = pipe(
      createTransactionMessage(),
      (value) => setTransactionMessageFeePayer(address("11111111111111111111111111111112"), value),
      (value) => setTransactionMessageLifetimeUsingBlockhash({
        blockhash: address("11111111111111111111111111111111"),
        lastValidBlockHeight: 1n,
      }, value),
      (value) => appendTransactionMessageInstructions([getAddMemoInstruction("no signer")], value),
    )
    await expect(Effect.runPromise(signer.signTransaction(compileTransaction(message)))).rejects.toThrow(
      /not required/,
    )
  })

  it("matches the official partial-signing fixture with an external fee payer", async () => {
    const signer = await Effect.runPromise(signerFromMnemonic(MNEMONIC))
    const feePayer = address("11111111111111111111111111111112")
    const mint = address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
    const tokenProgram = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
    const [[source], [destination]] = await Promise.all([
      findAssociatedTokenPda({ owner: signer.address, mint, tokenProgram }),
      findAssociatedTokenPda({ owner: feePayer, mint, tokenProgram }),
    ])
    const message = pipe(
      createTransactionMessage(),
      (value) => setTransactionMessageFeePayer(feePayer, value),
      (value) => setTransactionMessageLifetimeUsingBlockhash({
        blockhash: address("11111111111111111111111111111111"),
        lastValidBlockHeight: 1n,
      }, value),
      (value) => appendTransactionMessageInstructions([
        getTransferCheckedInstruction({
          source,
          mint,
          destination,
          authority: signer.address,
          tokenProgram,
          amount: 1_000_000n,
          decimals: 6,
        }),
      ], value),
    )
    const transaction = compileTransaction(message)
    expect(Object.keys(transaction.signatures)).toEqual([feePayer, signer.address])
    expect(Encoding.encodeHex(transaction.messageBytes)).toBe(EXPECTED_PARTIAL_MESSAGE)
    const signed = await Effect.runPromise(signer.signTransaction(transaction))
    expect(signed.signatures[feePayer]).toBeNull()
    expect(getBase64EncodedWireTransaction(signed)).toBe(EXPECTED_PARTIAL_WIRE)
  })
})
