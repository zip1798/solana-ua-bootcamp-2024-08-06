import { mintTo, getOrCreateAssociatedTokenAccount, createMultisig, createMint } from "@solana/spl-token";
import "dotenv/config";
import {
  getExplorerLink,
  getKeypairFromEnvironment,
  airdropIfRequired
} from "@solana-developers/helpers";
import { Connection, PublicKey, clusterApiUrl, Keypair, LAMPORTS_PER_SOL} from "@solana/web3.js";
const connection = new Connection(clusterApiUrl("devnet"));

// Our token has two decimal places
const MINOR_UNITS_PER_MAJOR_UNITS = Math.pow(10, 2);

const sender = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env["SECRET_KEY"]||'')));
const multisigSigner2 = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env["SECRET_KEY2"]||'')));
const multisigSigner3 = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env["SECRET_KEY3"]||'')));

// await airdropIfRequired(connection, sender.publicKey, 1 * LAMPORTS_PER_SOL, 0.5 * LAMPORTS_PER_SOL);
// await airdropIfRequired(connection, multisigSigner2.publicKey, 1 * LAMPORTS_PER_SOL, 0.5 * LAMPORTS_PER_SOL);
// await airdropIfRequired(connection, multisigSigner3.publicKey, 1 * LAMPORTS_PER_SOL, 0.5 * LAMPORTS_PER_SOL);

const multisigAccountPubkey: PublicKey = await createMultisig(
    connection,
    sender,
    [
      sender.publicKey, // B5EucqcybsSdvP2CYQzJwmKDmTLgPMWnY2Gswjv4LwNb
      multisigSigner2.publicKey, // SECRET_KEY2
      multisigSigner3.publicKey, // SECRET_KEY3
    ],
    2
);
  
const link_multisigAccount_from = getExplorerLink("address", multisigAccountPubkey.toString(), "devnet");

console.log(`✅ Create Multisig Account transaction: ${link_multisigAccount_from}`);
console.log(`Multisig Account: ${multisigAccountPubkey.toString()}`);


// Create token mint account with multisig account as authority
const tokenMintPubkey: PublicKey = await createMint(
    connection,
    sender,
    multisigAccountPubkey,
    null,
    2
);

const link_create_mint = getExplorerLink("address", tokenMintPubkey.toString(), "devnet");
console.log(`✅ Token Mint: ${link_create_mint}`);
console.log(`Token Mint Address: ${tokenMintPubkey.toString()}`);

 
const recipientAssociatedTokenAccount = new PublicKey(
  "B5EucqcybsSdvP2CYQzJwmKDmTLgPMWnY2Gswjv4LwNb" // (for test)
);
const associatedTokenAccount = await getOrCreateAssociatedTokenAccount(
  connection,
  sender,
  tokenMintPubkey,
  recipientAssociatedTokenAccount
);

const transactionSignature = await mintTo(
  connection, 
  sender, // who pays for the transaction
  tokenMintPubkey, // our token mint
  associatedTokenAccount.address, // our recipient
  multisigAccountPubkey, // our mint authority account
  5555 * MINOR_UNITS_PER_MAJOR_UNITS, // amount
  [multisigSigner2, multisigSigner3] // array of multisig signers
);

const link = getExplorerLink("transaction", transactionSignature, "devnet");

console.log(`✅ Success! 5555 tokens minted to ${recipientAssociatedTokenAccount.toString()} with 2 signatures.\n Mint Transaction: ${link}`);

