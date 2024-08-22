import "dotenv/config";
import base58 from "bs58";
import { 
    mintTo, 
    getOrCreateAssociatedTokenAccount, 
    transfer, 
    createTransferCheckedInstruction 
} from "@solana/spl-token";
import "dotenv/config";
import {
  getExplorerLink,
  getKeypairFromEnvironment,
} from "@solana-developers/helpers";
import { 
  Connection, 
  PublicKey, 
  clusterApiUrl, 
  Transaction, 
  Keypair,
  SystemProgram,
  NonceAccount,
  NONCE_ACCOUNT_LENGTH 
} from "@solana/web3.js";
const connection = new Connection(clusterApiUrl("devnet"));

// Our token has two decimal places
const MINOR_UNITS_PER_MAJOR_UNITS = Math.pow(10, 2);
const TRANSFER_AMOUNT = 2700;

let privateKey = process.env["SECRET_KEY"];
if (privateKey === undefined) {
  console.log("Add SECRET_KEY to .env!");
  process.exit(1);
}

const sender = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env["SECRET_KEY"]||'')));
const recipient = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env["SECRET_KEY2"]||'')));
const nonceKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env["NONCE_ACCOUNT_KEY"]||'')));

const mintPublicKey = new PublicKey(
  "EuEFLK2sBJhFjGe2LWC8aE4WbWQcS38N3rdg73aSw2gb"
);


// Get Nonce Account 
let nonceAccount: NonceAccount | null = null;
nonceAccount = await getNonceAccount(nonceKeypair.publicKey);
if (nonceAccount === null) {
    await createNonceAccount(sender, sender, nonceKeypair );    
    nonceAccount = await getNonceAccount(nonceKeypair.publicKey);
}
if (nonceAccount === null) {
    throw new Error(`Unable to find nonce account: ${nonceKeypair.publicKey}`);
}

console.log('Nonce Account: ', nonceKeypair.publicKey.toBase58());
console.log('Nonce: ', nonceAccount.nonce);


// get sender token account
const senderTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    sender,
    mintPublicKey,
    sender.publicKey
);

// mint some tokens to sender
const transactionSignature = await mintTo(
    connection,
    sender,
    mintPublicKey,
    senderTokenAccount.address,
    sender,
    TRANSFER_AMOUNT
);
const linkMint = getExplorerLink("transaction", transactionSignature, "devnet");
console.log(`✅ Success! Mint Transaction: ${linkMint}\n`);

// get recipient token account
const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    sender,
    mintPublicKey,
    recipient.publicKey
);


const transaction = new Transaction();
transaction.add(
    SystemProgram.nonceAdvance({
        noncePubkey: nonceKeypair.publicKey,
        authorizedPubkey: sender.publicKey,
    }),
    createTransferCheckedInstruction(
      senderTokenAccount.address, // source
      mintPublicKey, // mint
      recipientTokenAccount.address, // destination
      sender.publicKey, // owner of source account
      TRANSFER_AMOUNT, // amount to transfer
      2
    )
);
transaction.recentBlockhash = nonceAccount.nonce;
transaction.feePayer = recipient.publicKey;

transaction.partialSign(sender);

// Serialize the transaction and convert to base64 to return it
const serializedTransaction = transaction.serialize({
  // We will need recipient to deserialize and sign the transaction
  requireAllSignatures: false,
});
const transactionBase64 = serializedTransaction.toString("base64");
console.log(`Partial Sign Transaction: ${transactionBase64}\n\n`);

console.log("Start sleep for 120sec\n");
await new Promise(resolve => setTimeout(resolve, 120000));
console.log("End sleep for 120sec\n");

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


/**
 * Result of execution:
 * 
 */

async function createNonceAccount(payer: Keypair, auth: Keypair, nonceAccount: Keypair ) {
    let tx = new Transaction();
    tx.add(
        // create nonce account
        SystemProgram.createAccount({
            fromPubkey: payer.publicKey,
            newAccountPubkey: nonceAccount.publicKey,
            lamports: await connection.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH),
            space: NONCE_ACCOUNT_LENGTH,
            programId: SystemProgram.programId,
        }),
        // init nonce account
        SystemProgram.nonceInitialize({
            noncePubkey: nonceAccount.publicKey, // nonce account pubkey
            authorizedPubkey: auth.publicKey, // nonce account auth
        })
    );
    tx.feePayer = payer.publicKey;
    const signature = await connection.sendTransaction(tx, [nonceAccount, payer])
    const link = getExplorerLink("transaction", signature, "devnet");

    console.log(`Nonce Account: ${nonceAccount.publicKey.toBase58()}`);
    console.log(`Create Nonce Account Transaction: ${link}`)
}


async function getNonceAccount(nonceAccountPubkey: PublicKey) { 
    const accountInfo = await connection.getAccountInfo(nonceAccountPubkey);

    if (accountInfo === null) {
        return null;
        // throw new Error(`Unable to find nonce account: ${nonceAccountPubkey}`);
    }

    return  NonceAccount.fromAccountData(accountInfo.data);
}