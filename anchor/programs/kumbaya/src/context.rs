use anchor_lang::prelude::*;
use std::str::FromStr;

// use anchor_spl::{
//     associated_token::AssociatedToken,
//     token::{Mint, Token, TokenAccount}
// };

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        Mint,
        TokenAccount,
        TokenInterface,
        // TransferChecked, close_account, transfer_checked, CloseAccount,
    },
};

use crate::constants::*;
use crate::state::*;

#[derive(Accounts)]
pub struct InitGlobal<'info> {
    // only the HOUSE can pay for this
    #[account(mut, constraint = house.key() == Pubkey::from_str(HOUSE).unwrap())]
    pub house: Signer<'info>,

    #[account(init, payer = house, seeds = [b"global"], space = Global::LEN, bump)]
    pub global: Account<'info, Global>,

    // main net USDC mint account
    // #[account(constraint = usdc_mint.key() == Pubkey::from_str(USDC_MINT).unwrap())]
    // pub usdc_mint: InterfaceAccount<'info, Mint>,

    // devnet USDC mint account
    // #[account(constraint = usdc_mint.key() == Pubkey::from_str(USDC_DEVNET_MINT).unwrap())]
    pub usdc_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = house,
        associated_token::mint = usdc_mint,
        associated_token::authority = house
    )]
    pub house_usdc_ata: InterfaceAccount<'info, TokenAccount>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitGlobal<'info> {
    pub fn init(&mut self, bumps: &InitGlobalBumps) -> Result<()> {
        self.global.set_inner(Global {
            house: self.house.key(),
            global_bump: bumps.global,
        });
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct CreateMerchant<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(init, payer = owner, seeds = [b"merchant", name.as_str().as_bytes(), owner.key().as_ref()], space = Merchant::LEN, bump)]
    pub merchant: Account<'info, Merchant>,

    // main net USDC mint account
    // #[account(constraint = usdc_mint.key() == Pubkey::from_str(USDC_MINT).unwrap())]
    // pub usdc_mint: InterfaceAccount<'info, Mint>,

    // devnet USDC mint account
    // #[account(constraint = usdc_mint.key() == Pubkey::from_str(USDC_DEVNET_MINT).unwrap())]
    pub usdc_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = owner,
        associated_token::mint = usdc_mint,
        associated_token::authority = merchant
    )]
    pub merchant_usdc_ata: InterfaceAccount<'info, TokenAccount>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> CreateMerchant<'info> {
    pub fn init(&mut self, bumps: &CreateMerchantBumps, name: String) -> Result<()> {
        self.merchant.set_inner(Merchant {
            owner: self.owner.key(),
            entity_name: name,
            merchant_bump: bumps.merchant,
        });
        Ok(())
    }
}


