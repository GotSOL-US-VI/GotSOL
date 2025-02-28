use anchor_lang::prelude::*;
// use anchor_spl::associated_token::AssociatedToken;
use std::str::FromStr;

// use anchor_spl::{
//     associated_token::AssociatedToken,
//     token::{Mint, Token, TokenAccount}
// };

use crate::constants::*;
use crate::state::*;

#[derive(Accounts)]
pub struct InitGlobal<'info> {
    // only the HOUSE can pay for this
    #[account(mut, constraint = house.key() == Pubkey::from_str(HOUSE).unwrap())]
    pub house: Signer<'info>,

    #[account(init, payer = house, seeds = [b"global"], space = Global::LEN, bump)]
    pub global: Account<'info, Global>,

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

    // #[account(constraint = usdc_mint.key() == Pubkey::from_str(USDC_MINT).unwrap())]
    // pub usdc_mint: Account<'info, Mint>,
    /// CHECK: This is the USDC mint
    // pub usdc_mint: Account<'info, Mint>,

    // #[account(
    //     init,
    //     payer = owner,
    //     associated_token::mint = usdc_mint,
    //     associated_token::authority = merchant
    // )]
    // pub merchant_usdc_ata: Account<'info, TokenAccount>,

    // pub token_program: Program<'info, Token>,
    // pub associated_token_program: Program<'info, AssociatedToken>,
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
