import { mintTo, 
  getOrCreateAssociatedTokenAccount, 
  createMultisig, 
  createMint, 
  createTransferInstruction,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import "dotenv/config";
import {
  getExplorerLink,
  getKeypairFromEnvironment,
  airdropIfRequired
} from "@solana-developers/helpers";
import { Connection, PublicKey, clusterApiUrl, Keypair, LAMPORTS_PER_SOL, Transaction} from "@solana/web3.js";
const connection = new Connection(clusterApiUrl("devnet"));

// Our token has two decimal places
const MINOR_UNITS_PER_MAJOR_UNITS = Math.pow(10, 2);

const sender = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env["SECRET_KEY"]||'')));
const recipient = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env["SECRET_KEY2"]||'')));

// Create token mint account 
const tokenMintPubkey: PublicKey = await createMint(
    connection,
    sender,
    sender.publicKey,
    null,
    2
);

const link_create_mint = getExplorerLink("address", tokenMintPubkey.toString(), "devnet");
console.log(`✅ Token Mint: ${link_create_mint}`);
console.log(`Token Mint Address: ${tokenMintPubkey.toString()}`);


const associatedSenderTokenAccount = await getOrCreateAssociatedTokenAccount(
  connection,
  sender,
  tokenMintPubkey,
  sender.publicKey
);

const associatedRecipientTokenAccount = await getOrCreateAssociatedTokenAccount(
  connection,
  sender,
  tokenMintPubkey,
  recipient.publicKey
);

// Mint some tokens to sender
const tx_mint = await mintTo(
  connection, 
  sender, // who pays for the transaction
  tokenMintPubkey, // our token mint
  associatedSenderTokenAccount.address, 
  sender, // our mint authority account
  100000 * MINOR_UNITS_PER_MAJOR_UNITS, // amount
);

const link_mint = getExplorerLink("transaction", tx_mint, "devnet");
console.log(`✅ 100000 tokens ${tokenMintPubkey.toString()}  minted to ${sender.publicKey.toString()} .\n Mint Transaction: ${link_mint}\n\n`);

await new Promise(resolve => setTimeout(resolve, 60000));


// Transfer 500 tokens from sender to recipient

const tx_transfer = new Transaction().add(
  createTransferInstruction(
    associatedSenderTokenAccount.address,
    associatedRecipientTokenAccount.address,
    sender.publicKey,
    500 * MINOR_UNITS_PER_MAJOR_UNITS,
  )
);

tx_transfer.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
tx_transfer.feePayer = recipient.publicKey;
tx_transfer.partialSign(sender);

const serializedTransaction = tx_transfer.serialize({
  // We will need recipient to deserialize and sign the transaction
  requireAllSignatures: false,
});
const transactionBase64 = serializedTransaction.toString("base64");
console.log(`Partial Sign Transaction: ${transactionBase64}\n\n`);


////////////////////////////////////////////////////////////////////////////////////////////
// Recipient part of the transaction

// Deserialize the transaction
const recoveredTransaction = Transaction.from(
  Buffer.from(transactionBase64, "base64")
);

recoveredTransaction.partialSign(recipient);
const recoveredTransactionSignature = await connection.sendRawTransaction(
    recoveredTransaction.serialize(),
  );

const linkRecoveredTransactionSignature = getExplorerLink("transaction", recoveredTransactionSignature, "devnet");
console.log(`✅ Success! Partial Transfer Transaction: ${linkRecoveredTransactionSignature}`);
