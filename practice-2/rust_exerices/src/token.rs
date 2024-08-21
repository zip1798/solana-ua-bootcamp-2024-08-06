/*
Перепишіть всі TypeScript скрипти із завдань 2.1 - 2.6 на Rust.  
Дивіться solana-sdk, та solana-client, spl-token, та mpl-token-metadata на
crates.io.
Вам потрібно переписати 
send-sol.ts, 
create-token-mint.ts, 
create-token-account.ts, 
mint-tokens.ts, 
create-token-metadata.ts.

Додайте код до вашого github форку, та долучіть скриншот, або декілька скриншотів, котрі демонструють виконання всіх програм.
Скрипти можна об'єднати в один crate, створивши декілька незалежних бінарників, або створити декілька крейтів.
*/

// use solana_sdk::instruction::{AccountMeta, Instruction};
use solana_sdk::signature::{Keypair, Signer};
use solana_sdk::transaction::Transaction;
use solana_sdk::pubkey::Pubkey;
// use solana_program::pubkey::Pubkey as PrgPubkey;
// use solana_program::instruction::Instruction as PrgInstruction;
use solana_sdk::system_instruction;
use spl_token::instruction as token_instruction;
use spl_token::state::Mint;
use solana_client::rpc_client::RpcClient;
use solana_sdk::program_pack::Pack;
// use solana_program::system_program::ID as SYS_PROGRAM_ID;   

// спробувати замінити чимось
use spl_associated_token_account::instruction::create_associated_token_account;
use spl_associated_token_account::get_associated_token_address_with_program_id;

// use std::str::FromStr;

// use spl_token::instruction::initialize_account;
// use spl_token::state::Account as TokenAccount;

use mpl_token_metadata::instructions::CreateV1InstructionArgs;
use mpl_token_metadata::types::PrintSupply;
use mpl_token_metadata::types::TokenStandard;


const RPC_URL: &str = "https://api.devnet.solana.com";

pub fn create_mint(payer_keypair: &Keypair) -> Keypair {
    let client = RpcClient::new(RPC_URL);

    // Generate a new keypair for the mint
    let mint_keypair = Keypair::new();
    let mint_pubkey = mint_keypair.pubkey();

    // Create the mint account
    let lamports = client.get_minimum_balance_for_rent_exemption(Mint::LEN).unwrap();
    let create_account_ix = system_instruction::create_account(
        &payer_keypair.pubkey(),
        &mint_pubkey,
        lamports,
        Mint::LEN as u64,
        &spl_token::id(),
    );

    // Initialize mint
    let initialize_mint_ix = token_instruction::initialize_mint(
        &spl_token::id(),
        &mint_pubkey,
        &payer_keypair.pubkey(),
        None,
        2,
    ).unwrap();

    // Create transaction
    let mut transaction = Transaction::new_with_payer(
        &[create_account_ix, initialize_mint_ix],
        Some(&payer_keypair.pubkey()),
    );

    // Sign transaction
    transaction.sign(&[&payer_keypair, &mint_keypair], client.get_latest_blockhash().unwrap());

    // Send transaction
    match client.send_and_confirm_transaction(&transaction) {
        Ok(signature) => {
            println!("✅ Token Mint created: {}, {}\n\n", mint_pubkey, signature);
        }
        Err(err) => {
            eprintln!("Error creating mint: {:?}", err);
        }
    }

    mint_keypair
}


pub fn create_associated_account(payer_keypair: &Keypair, wallet: &Pubkey, mint_keypair: &Keypair) -> Pubkey {
    let client = RpcClient::new(RPC_URL);
    let mint_pubkey = &mint_keypair.pubkey();

/*     
    // Get the associated token account address for the user
    let associated_token_address = Pubkey::find_program_address(
        &[
            &wallet.to_bytes(),
            &spl_token::id().to_bytes(),
            &mint_pubkey.to_bytes(),
        ],
        &spl_token::id(),
    ).0;

    // Create the associated token account
    let create_account_ix = system_instruction::create_account(
        &payer_keypair.pubkey(),
        &associated_token_address,
        client.get_minimum_balance_for_rent_exemption(TokenAccount::LEN).unwrap(),
        TokenAccount::LEN as u64,
        &spl_token::id(),
    );

    // Create the associated token account
    let create_associated_token_account_ix = initialize_account(
        &spl_token::id(),
        &associated_token_address,
        mint_pubkey,
        &payer_keypair.pubkey(),
    ).unwrap();

*/

    //*   
    let associated_account_address = get_associated_token_address_with_program_id(
        wallet,
        mint_pubkey,
        &spl_token::id(),
    );

    // Create the associated token account
    let create_associated_token_account_ix = create_associated_token_account(
        &payer_keypair.pubkey(),
        wallet,
        mint_pubkey,
        &spl_token::id(),
    );

    //*/

    // Create transaction
    let mut transaction = Transaction::new_with_payer(
        &[create_associated_token_account_ix],
        Some(&payer_keypair.pubkey()),
    );

    // Sign transaction
    transaction.sign(&[payer_keypair], client.get_latest_blockhash().unwrap());

    // Send transaction
    match client.send_and_confirm_transaction(&transaction) {
        Ok(signature) => {
            println!("✅ Associated Token Account created: {:?}, {:?}\n\n", signature, associated_account_address);
        }
        Err(err) => {
            eprintln!("Error creating mint: {:?}", err);
        }
    }

    associated_account_address
}


pub fn mint_token(
    payer_keypair: &Keypair
    , mint_keypair: &Keypair
    , wallet: &Pubkey
    , associated_account_address: &Pubkey
    , mint_amount: u64) 
{
    let client = RpcClient::new(RPC_URL);
    
    let mint_to_ix = token_instruction::mint_to(
        &spl_token::id(),
        &mint_keypair.pubkey(),
        associated_account_address,
        &payer_keypair.pubkey(),
        &[],
        mint_amount,
    ).unwrap();

    // Create the transaction
    let mut transaction = Transaction::new_with_payer(
        &[mint_to_ix],
        Some(&payer_keypair.pubkey()),
    );

    // Sign the transaction
    transaction.sign(&[&payer_keypair], client.get_latest_blockhash().unwrap());

    // Send the transaction
    match client.send_and_confirm_transaction(&transaction) {
        Ok(signature) => {
            println!("💰✅ Minted {:?} tokens to {:?} ! Signature: {:?}", mint_amount, wallet, signature);
        },
        Err(e) => {
            eprintln!("Error creating mint account: {:?}", e);
        }
    }

}

pub fn create_token_metadata_account(
    payer_keypair: &Keypair
    , mint_pubkey: &Pubkey
    , token_name: &str
    , token_symbol: &str
    , metadata_uri: &str
) 
{
    let client = RpcClient::new(RPC_URL);
    // let metadata_id: Pubkey = Pubkey::from_str("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").unwrap();
    let (metadata_account, _) = Pubkey::find_program_address(
        &[
            b"metadata".as_ref(),
            &mpl_token_metadata::ID.to_bytes(),
            &mint_pubkey.to_bytes(),
        ],
        &mpl_token_metadata::ID,
    );


    let create_ix = mpl_token_metadata::instructions::CreateV1Builder::new()
        .metadata(metadata_account)
        .master_edition(Some(*mint_pubkey))
        .mint(*mint_pubkey, true)
        .authority(payer_keypair.pubkey())
        .payer(payer_keypair.pubkey())
        .update_authority(payer_keypair.pubkey(), true)
        .is_mutable(true)
        .primary_sale_happened(false)
        .name(String::from(token_name))
        .symbol(String::from(token_symbol))
        .uri(String::from(metadata_uri))
        .seller_fee_basis_points(500)
        .token_standard(TokenStandard::Fungible)
        .print_supply(PrintSupply::Zero)
        .instruction();

    // Get the recent blockhash
    let recent_blockhash = client.get_latest_blockhash().unwrap();

    // Create the transaction
    
    let mut transaction = Transaction::new_with_payer(&[create_ix], Some(&payer_keypair.pubkey()));
    transaction.sign(&[&payer_keypair], recent_blockhash);

    // Send the transaction
    match client.send_and_confirm_transaction(&transaction) {
        Ok(signature) => {
            println!("Metadata account created successfully with signature: {:?}/n/n", signature);
        }
        Err(err) => {
            eprintln!("Failed to create metadata account: {:?}", err);
        }
    }
}

// fn make_prg_pubkey(pubkey: &Pubkey) -> PrgPubkey {
//     PrgPubkey::new_from_array(pubkey.to_bytes())
// }

