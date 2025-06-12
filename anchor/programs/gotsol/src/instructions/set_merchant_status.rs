use anchor_lang::prelude::*;
use crate::state::Merchant;
use crate::constants::*;
use crate::errors::*;

use std::str::FromStr;



#[derive(Accounts)]
pub struct SetMerchantStatus<'info> {
    /// CHECK: This is the HOUSE Squads multi-sig that must sign
    #[account(mut, constraint = auth.key() == Pubkey::from_str(AUTH_2).unwrap() || auth.key() == Pubkey::from_str(AUTH_3).unwrap() @ CustomError::UnauthorizedStatusChange)]
    pub auth: Signer<'info>,

    #[account(mut)]
    pub merchant: Box<Account<'info, Merchant>>,

    pub system_program: Program<'info, System>,
}

impl<'info> SetMerchantStatus<'info> {
    pub fn set_status(&mut self, fee_eligible: bool) -> Result<()> {
        self.merchant.fee_eligible = fee_eligible;

        Ok(())
    }
}