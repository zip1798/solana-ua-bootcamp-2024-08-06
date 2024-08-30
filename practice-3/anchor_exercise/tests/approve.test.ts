import { expect, describe, beforeAll, test } from "@jest/globals";
import * as anchor from "@coral-xyz/anchor";
import { type Program, BN } from "@coral-xyz/anchor";
import { Approve } from "../target/types/approve";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  type TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";
import { randomBytes } from "crypto";

import { confirmTransaction, makeKeypairs } from "@solana-developers/helpers";

import { createTokenAndMintTo, getTokenBalanceOn, transferSplTokenIx } from "./token.lib";
import { areBnEqual, getRandomBigNumber } from "./utils.lib";

const TOKEN_PROGRAM: typeof TOKEN_2022_PROGRAM_ID | typeof TOKEN_PROGRAM_ID =
  TOKEN_2022_PROGRAM_ID;


expect.addEqualityTesters([areBnEqual]);

/**
 * Tests for program
 */
describe("escrow with approve", () => {
    // Use the cluster and the keypair from Anchor.toml
    anchor.setProvider(anchor.AnchorProvider.env());

    const provider = anchor.getProvider();

    // See https://github.com/coral-xyz/anchor/issues/3122
    // const user = (provider.wallet as anchor.Wallet).payer;
    // const payer = user;

    const connection = provider.connection;

    const program = anchor.workspace.Approve as Program<Approve>;

    const [alice, bob, usdcMint, wifMint] = makeKeypairs(4);

    const [aliceUsdcAccount, aliceWifAccount, bobUsdcAccount, bobWifAccount] = [
        alice,
        bob,
    ].flatMap((owner) =>
        [usdcMint, wifMint].map((tokenMint) =>
            getAssociatedTokenAddressSync(
                tokenMint.publicKey,
                owner.publicKey,
                false,
                TOKEN_PROGRAM
            )
        )
    );

    // Pick a random ID for the new offer.
    const offerId = getRandomBigNumber();

    // console.log('Alice: ', alice.publicKey.toBase58())
    // console.log('Bob: ', alice.publicKey.toBase58())

    /**
     * BEFORE ALL
     * 
     * Creates Alice and Bob accounts, 2 token mints, and associated token
     * accounts for both tokens for both users.
     */
    beforeAll(async () => {
        // global.console = require('console');

        // Transfer 10 SOL to Alice and Bob from the anchor provider
        const giveAliceAndBobSolIxs: Array<TransactionInstruction> = [
            alice,
            bob,
        ].map((owner) =>
            SystemProgram.transfer({
                fromPubkey: provider.publicKey,
                toPubkey: owner.publicKey,
                lamports: 10 * LAMPORTS_PER_SOL,
            })
        );

        // Create the USDC token mints and associated token accounts
        const usdcSetupIxs = await createTokenAndMintTo(
            connection,
            provider.publicKey,
            usdcMint.publicKey,
            6,
            alice.publicKey,
            [
                { recepient: alice.publicKey, amount: 100_000_000 },
                { recepient: bob.publicKey, amount: 20_000_000 },
            ]
        );

        // Create the WIF token mints and associated token accounts
        const wifSetupIxs = await createTokenAndMintTo(
            connection,
            provider.publicKey,
            wifMint.publicKey,
            6,
            bob.publicKey,
            [
                { recepient: alice.publicKey, amount: 5_000_000 },
                { recepient: bob.publicKey, amount: 300_000_000 },
            ]
        );

        // Add all these instructions to our transaction
        let tx = new Transaction();
        tx.instructions = [
            ...giveAliceAndBobSolIxs,
            ...usdcSetupIxs,
            ...wifSetupIxs,
        ];

        // Send and confirm the transaction
        const _setupTxSig = await provider.sendAndConfirm(tx, [
            alice,
            bob,
            usdcMint,
            wifMint,
        ]);
    });    


    /**
     * Create an offer escrow transaction and confirm it
     * that make offer PDA account and approve usage of the offeredTokenMint token to offer PDA
     * @param maker 
     * @param offerId 
     * @param offeredTokenMint 
     * @param offeredAmount 
     * @param wantedTokenMint 
     * @param wantedAmount 
     * @returns 
     * offerAddress: PublicKey
     */
    const makeOfferTx = async (
        maker: Keypair,
        offerId: BN,
        offeredTokenMint: PublicKey,
        offeredAmount: BN,
        wantedTokenMint: PublicKey,
        wantedAmount: BN
      ): Promise<{
        offerAddress: PublicKey;
      }> => {
            const transactionSignature = await program.methods
                .makeOffer(offerId, offeredAmount, wantedAmount)
                .accounts({
                    maker: maker.publicKey,
                    tokenMintA: offeredTokenMint,
                    tokenMintB: wantedTokenMint,
                    // As the `token_program` account is specified as
                    //
                    //   pub token_program: Interface<'info, TokenInterface>,
                    //
                    // the client library needs us to provide the specific program address
                    // explicitly.
                    //
                    // This is unlike the `associated_token_program` or the `system_program`
                    // account addresses, that are specified in the program IDL, as they are
                    // expected to reference the same programs for all the `makeOffer`
                    // invocations.
                    tokenProgram: TOKEN_PROGRAM,
                })
                .signers([maker])
                .rpc();
    
            await confirmTransaction(connection, transactionSignature);
    
            // The `offer` address account is computed based
            // on the other provided account addresses, and so we do not need to provide
            // them explicitly in the `makeOffer()` account call above.  But we compute
            // them here and return for convenience.
        
            const [offerAddress, _offerBump] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("offer"),
                    maker.publicKey.toBuffer(),
                    offerId.toArrayLike(Buffer, "le", 8),
                ],
                program.programId
            );
    
        return { offerAddress };
    };
    

    const takeOfferTx = async (
        offerAddress: PublicKey,
        makerAddress: PublicKey,
        taker: Keypair,
      ): Promise<void> => {
    
        // `accounts` argument debugging tool.  Should be part of Anchor really.
        //
        // type FlatType<T> = T extends object
        //   ? { [K in keyof T]: FlatType<T[K]> }
        //   : T;
        
        // type AccountsArgs = FlatType<
        //   Parameters<
        //     ReturnType<
        //       Program<Approve>["methods"]["takeOffer"]
        //     >["accounts"]
        //   >
        // >;
    
        const transactionSignature = await program.methods
          .takeOffer()
          .accounts({
            taker: taker.publicKey,
            //@ts-ignore
            offer: offerAddress,
            // See note in the `makeOfferTx` on why this program address is provided
            // and the rest are not.
            tokenProgram: TOKEN_PROGRAM,
          })
          .signers([taker])
          .rpc();
    
        await confirmTransaction(connection, transactionSignature);
      };
    


    /**
     * Tests that an offer can be created by Alice and token not tranferred
     * 
     */
    test("Offer created by Alice, tokens not transferred", async () => {
        const offeredUsdc = new BN(10_000_000);
        const wantedWif = new BN(100_000_000);

        const getTokenBalance = getTokenBalanceOn(connection);

        const { offerAddress } = await makeOfferTx(
            alice,
            offerId,
            usdcMint.publicKey,
            offeredUsdc,
            wifMint.publicKey,
            wantedWif
        );


        expect(await getTokenBalance(aliceUsdcAccount)).toEqual(new BN(100_000_000));

        // Check our Offer account contains the correct data
        const offerAccount = await program.account.offer.fetch(offerAddress);
        expect(offerAccount.maker).toEqual(alice.publicKey);
        expect(offerAccount.tokenMintA).toEqual(usdcMint.publicKey);
        expect(offerAccount.tokenMintB).toEqual(wifMint.publicKey);
        expect(offerAccount.tokenAAmount).toEqual(offeredUsdc);
        expect(offerAccount.tokenBWantedAmount).toEqual(wantedWif);
    });




    /**
     * Tests that an offer can taked by Bob and tokens are tranferred
     * 
     */
    test("Offer taken by Bob, tokens balances are updated", async () => {
        const getTokenBalance = getTokenBalanceOn(connection);
    
        // This test reuses offer created by the previous test.  Bad design :(
        // But it is a shortcut that allows us to avoid writing the cleanup code.
        // TODO Add proper cleanup, that mirrors `beforeEach`, and create a new
        // offer here.
    
        const [offerAddress, _offerBump] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("offer"),
            alice.publicKey.toBuffer(),
            offerId.toArrayLike(Buffer, "le", 8),
          ],
          program.programId
        );
        
        // Verify state before the offer is taken.
        expect(await getTokenBalance(aliceUsdcAccount)).toEqual(new BN(100_000_000));
        expect(await getTokenBalance(aliceWifAccount)).toEqual(new BN(5_000_000));
        expect(await getTokenBalance(bobUsdcAccount)).toEqual(new BN(20_000_000));
        expect(await getTokenBalance(bobWifAccount)).toEqual(new BN(300_000_000));

        await takeOfferTx(offerAddress, alice.publicKey, bob);
    
        expect(await getTokenBalance(aliceUsdcAccount)).toEqual(new BN(90_000_000));
        expect(await getTokenBalance(aliceWifAccount)).toEqual(new BN(105_000_000));
    
        expect(await getTokenBalance(bobUsdcAccount)).toEqual(new BN(30_000_000));
        expect(await getTokenBalance(bobWifAccount)).toEqual(new BN(200_000_000));
    });

    /**
     * Tests that an offer can taked by Bob and tokens are tranferred
     * 
     */
    test("Create offer, then spend tokens, and try to take offer, got error. Balances are not updated", async () => {
        const offerId = getRandomBigNumber();

        const offeredUsdc = new BN(89_000_000);
        const wantedWif = new BN(100_000_000);

        const getTokenBalance = getTokenBalanceOn(connection);

        const { offerAddress } = await makeOfferTx(
            alice,
            offerId,
            usdcMint.publicKey,
            offeredUsdc,
            wifMint.publicKey,
            wantedWif
        );

        expect(await getTokenBalance(aliceUsdcAccount)).toEqual(new BN(90_000_000));

        // send some usdc tokens after the offer is created
        let tx = new Transaction();
        tx.instructions = [await transferSplTokenIx(
            connection,
            alice,
            usdcMint.publicKey,
            5_000_000,
            6,
            aliceUsdcAccount,
            bobUsdcAccount
        )];
        const _setupTxSig = await provider.sendAndConfirm(tx, [alice]);

        try {
            await takeOfferTx(offerAddress, alice.publicKey, bob);
        } catch (error) {
            // console.log(error.message);
            expect(error).toBeDefined();
        }
    
        expect(await getTokenBalance(aliceUsdcAccount)).toEqual(new BN(85_000_000));
        expect(await getTokenBalance(aliceWifAccount)).toEqual(new BN(105_000_000));
    
        expect(await getTokenBalance(bobUsdcAccount)).toEqual(new BN(35_000_000));
        expect(await getTokenBalance(bobWifAccount)).toEqual(new BN(200_000_000));
    });
    
    

});