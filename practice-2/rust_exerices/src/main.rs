
use solana_sdk::signer::{keypair::Keypair, Signer};
use solana_sdk::pubkey::Pubkey;
use solana_client::rpc_client::RpcClient;
use dotenvy::dotenv;
use std::env;
use std::str::FromStr;

use solana_sdk::{
    transaction::Transaction,
    system_instruction,
};
pub mod token;
use token::*;

#[tokio::main]
async fn main() {
    generate_keypair();
    let wallet: Pubkey = Pubkey::from_str("B5EucqcybsSdvP2CYQzJwmKDmTLgPMWnY2Gswjv4LwNb").unwrap();

    let keypair = load_keypair();
    println!("🔑 Key loaded from .env file: {}\n\n ", keypair.try_pubkey().unwrap());

    run_check_balance(&keypair.pubkey()).await;
    send_sol(&keypair, &wallet, 20_000_000);

    let mint_keypair: Keypair = create_mint(&keypair);

    let associated_token_account: Pubkey = create_associated_account(&keypair, &wallet, &mint_keypair);

    mint_token(&keypair, &mint_keypair, &wallet, &associated_token_account, 177_00);

    let token_name = "Solana UA Bootcamp 2024-08-06";
    let token_symbol = "UAB-2";
    let metadata_uri = "https://teal-naval-condor-252.mypinata.cloud/ipfs/Qmah6qp79rco5tD44rNALzJpYSVJj84PswUPro96fRUPE2";

    create_token_metadata_account(&keypair, &mint_keypair.pubkey(), token_name, token_symbol, metadata_uri);
}

// Generate a new keypair
fn generate_keypair() {
    let key = Keypair::new();
    println!("✅ Generated new Keypair: {}", key.try_pubkey().unwrap());
    println!("{:?}\n  ", key.to_bytes());
}

// Load an existing keypair from .env file
fn load_keypair() -> Keypair {
    // Load the .env file
    dotenv().ok();

    let secret_key = env::var("SECRET_KEY").expect("SECRET_KEY must be set");

    // Remove the brackets and split the string by commas
    let trimmed = secret_key.trim_matches(&['[', ']'][..]);
    let bytes: Vec<u8> = trimmed
        .split(',')
        .filter_map(|s| s.trim().parse::<u8>().ok()) // Parse each component into u8
        .collect(); // Collect into a Vec<u8>

    // If you need a fixed-size array, you can convert it (only if the length is known)
    let secret_key_byte_array: [u8; 64] = bytes.try_into().expect("Incorrect length");
    let keypair: Keypair = Keypair::from_bytes(&secret_key_byte_array).expect("Invalid secret key");

    keypair
}


async fn run_check_balance(pubkey: &Pubkey) {
    match check_balance(pubkey).await {
        Ok(balance) => {
            println!("💰 The balance for the wallet at address {:?} is {:?} lamports\n\n", pubkey, balance);
        }
        Err(err) => {
            eprintln!("Error fetching balance: {:?}", err);
        }
    }
}

// Check balance loaded keypair
async fn check_balance(pubkey: &Pubkey)  -> Result<u64, solana_client::client_error::ClientError>  {
    // Create an RPC client to connect to the Solana cluster
    let rpc_url = "https://api.devnet.solana.com"; // Use the appropriate cluster URL
    let client = RpcClient::new(rpc_url);

    client.get_balance(pubkey)
}

fn send_sol(keypair: &Keypair, wallet: &Pubkey, amount: u64) {
    let rpc_url = "https://api.devnet.solana.com"; // Use the appropriate cluster URL
    let client = RpcClient::new(rpc_url);

    // Create the transfer instruction
    let instruction = system_instruction::transfer(&keypair.pubkey(), wallet, amount);

    // Get the recent blockhash
    let recent_blockhash = client.get_latest_blockhash().unwrap();

    // Create the transaction
    let mut transaction = Transaction::new_with_payer(&[instruction], Some(&keypair.pubkey()));
    transaction.sign(&[keypair], recent_blockhash);

    // Send the transaction
    match client.send_and_confirm_transaction(&transaction) {
        Ok(signature) => {
            println!("Send sol transaction successful with signature: {:?}\n\n", signature);
        }
        Err(err) => {
            eprintln!("Transaction failed: {:?}", err);
        }
    }

}