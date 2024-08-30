import { type Program, BN } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  type TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  createTransferInstruction,
  transferChecked
} from "@solana/spl-token";

const TOKEN_PROGRAM: typeof TOKEN_2022_PROGRAM_ID | typeof TOKEN_PROGRAM_ID =
  TOKEN_2022_PROGRAM_ID;
  
/**
 * Creates a new token mint and mints tokens to specified recipients.
 *
 * @param {Connection} connection - The Solana connection to use.
 * @param {PublicKey} payer - The public key of the account that will pay for the transaction.
 * @param {PublicKey} tokenMint - The public key of the token mint to create.
 * @param {number} decimals - The number of decimal places for the token.
 * @param {PublicKey} mintAuthority - The public key of the account that will have authority over the mint.
 * @param {Array<{ recepient: PublicKey; amount: number }>} mintTo - An array of objects specifying the recipients and amounts of tokens to mint.
 * @return {Promise<Array<TransactionInstruction>>} An array of transaction instructions to create the token mint and mint tokens.
 */
export const createTokenAndMintTo = async (
    connection: Connection,
    payer: PublicKey,
    tokenMint: PublicKey,
    decimals: number,
    mintAuthority: PublicKey,
    mintTo: Array<{ recepient: PublicKey; amount: number }>
  ): Promise<Array<TransactionInstruction>> => {
    let minimumLamports = await getMinimumBalanceForRentExemptMint(connection);
  
    let createTokeIxs = [
      SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: tokenMint,
        lamports: minimumLamports,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM,
      }),
      createInitializeMint2Instruction(
        tokenMint,
        decimals,
        mintAuthority,
        null,
        TOKEN_PROGRAM
      ),
    ];
  
    let mintToIxs = mintTo.flatMap(({ recepient, amount }) => {
      const ataAddress = getAssociatedTokenAddressSync(
        tokenMint,
        recepient,
        false,
        TOKEN_PROGRAM
      );
  
      return [
        createAssociatedTokenAccountIdempotentInstruction(
          payer,
          ataAddress,
          recepient,
          tokenMint,
          TOKEN_PROGRAM
        ),
        createMintToInstruction(
          tokenMint,
          ataAddress,
          mintAuthority,
          amount,
          [],
          TOKEN_PROGRAM
        ),
      ];
    });
  
    return [...createTokeIxs, ...mintToIxs];
  };
  
/**
 * Retrieves the balance of a token account on the given connection.
 *
 * @param {Connection} connection - The Solana connection to use.
 * @param {PublicKey} tokenAccountAddress - The address of the token account to retrieve the balance for.
 * @return {Promise<BN>} A Promise that resolves to the balance of the token account as a BigNumber.
 */
export  const getTokenBalanceOn = (
    connection: Connection,
  ) => async (
    tokenAccountAddress: PublicKey,
  ): Promise<BN> => {
    const tokenBalance = await connection.getTokenAccountBalance(tokenAccountAddress);
    return new BN(tokenBalance.value.amount);
  };

  
export const transferSplTokenIx = async (
    connection: Connection,
    payer: Keypair,
    mint: PublicKey,
    amount: number,
    decimals: number,
    fromATA: PublicKey,
    toATA: PublicKey
): Promise<TransactionInstruction> => {
  return createTransferCheckedInstruction(
      fromATA,
      mint,
      toATA,
      payer.publicKey,
      amount,
      decimals,
      [],
      TOKEN_PROGRAM
    );
}
  