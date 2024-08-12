
use solana_sdk::{signer::{keypair::Keypair, Signer}};
use solana_sdk::pubkey::Pubkey;
use solana_client::rpc_client::RpcClient;
use dotenvy::dotenv;
use std::env;

#[tokio::main]
async fn main() {
    generate_keypair();
    
    let keypair = load_keypair();
    println!("Key loaded from .env file: {}\n✅ Finished! \n\n ", keypair.try_pubkey().unwrap());

    match check_balance(&keypair.pubkey()).await {
        Ok(balance) => {
            println!("💰 The balance for the wallet at address {} is {} SOL", keypair.try_pubkey().unwrap(), balance / 1000000000);
        }
        Err(err) => {
            eprintln!("Error fetching balance: {:?}", err);
        }
    }
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


// Check balance loaded keypair
async fn check_balance(pubkey: &Pubkey)  -> Result<u64, solana_client::client_error::ClientError>  {
    // Create an RPC client to connect to the Solana cluster
    let rpc_url = "https://api.devnet.solana.com"; // Use the appropriate cluster URL
    let client = RpcClient::new(rpc_url);

    client.get_balance(pubkey)
}