use anchor_lang::prelude::*;

use anchor_spl::{
    associated_token::AssociatedToken,
    // token::{
    //     approve_checked, ApproveChecked
    // },
    token_interface::{Mint, TokenAccount, TokenInterface, Approve, approve},
};

use crate::{Offer, ANCHOR_DISCRIMINATOR};

// список аккаунтів які передаються в інструкцію delegate_offered_tokens_to_vault
// яка делегує токени в vault
#[derive(Accounts)]
#[instruction(id: u64)]
pub struct MakeOffer<'info> {
    #[account(mut)]
    pub maker: Signer<'info>, // хто буде делегувати свої токени в vault та платити комісійні

    #[account(mint::token_program = token_program)]
    pub token_mint_a: InterfaceAccount<'info, Mint>, // токен який передаємо в vault

    #[account(mint::token_program = token_program)]
    pub token_mint_b: InterfaceAccount<'info, Mint>, // токен який очікуємо отримати замість токена А

    #[account(
        mut,
        associated_token::mint = token_mint_a,
        associated_token::authority = maker,
        associated_token::token_program = token_program
    )]
    pub maker_token_account_a: InterfaceAccount<'info, TokenAccount>, // аккаунт токена А з якого в результаті всієї операції будуть списані токени А 
    
    #[account(
        init,
        payer = maker,
        space = ANCHOR_DISCRIMINATOR + Offer::INIT_SPACE,
        seeds = [b"offer", maker.key().as_ref(), id.to_le_bytes().as_ref()],
        bump
    )]
    pub offer: Account<'info, Offer>, // аккаунт, який містить інформацію про операцію, буде створений під час виконання інструкції 

    pub associated_token_program: Program<'info, AssociatedToken>, 
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}


pub fn delegate_offered_tokens_to_vault(
    context: &Context<MakeOffer>,
    token_a_offered_amount: u64,
) -> Result<()> {
    //* 
    let delegate_accounts = Approve {
        to: context.accounts.maker_token_account_a.to_account_info(), // аккаунт токена з якого будуть списуватись токени
        // mint: context.accounts.token_mint_a.to_account_info(), // токен на який делегуємо права 
        delegate: context.accounts.offer.to_account_info(), // кому буде делеговано право переказувати кошти
        authority: context.accounts.maker.to_account_info(), // хто може авторизувати цю операцію 
    };

    let cpi_context = CpiContext::new(
        context.accounts.token_program.to_account_info(),
        delegate_accounts
    );

    approve(
        cpi_context,
        token_a_offered_amount,
        // context.accounts.token_mint_a.decimals,
    )
    // */
    //Ok(())
}


/// Saves an offer in PDA account
///
/// # Errors
///
/// This function will return an error if .
pub fn save_offer(context: Context<MakeOffer>, id: u64, token_a_amount: u64, token_b_wanted_amount: u64) -> Result<()> {
    context.accounts.offer.set_inner(Offer {
        id,
        maker: context.accounts.maker.key(),
        token_mint_a: context.accounts.token_mint_a.key(),
        token_mint_b: context.accounts.token_mint_b.key(),
        token_a_amount,
        token_b_wanted_amount,
        bump: context.bumps.offer,
    });
    Ok(())
}
