use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};
use crate::state::Merchant;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;

use std::str::FromStr;

const OWNER_SHARE_BASIS_POINTS: u64 = 9900; // 99%
const HOUSE_SHARE_BASIS_POINTS: u64 = 100;  // 1%
const BASIS_POINTS_DIVISOR: u64 = 10000;
const MINIMUM_WITHDRAWAL_SOL_LAMPORTS: u64 = 1000; // 1000 lamports = 0.000001 SOL
// const MINIMUM_WITHDRAWAL_SPL_UNITS: u64 = 100; 

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct WithdrawSol<'info> {
    #[account(mut,
        constraint = amount >= MINIMUM_WITHDRAWAL_SOL_LAMPORTS @ CustomError::BelowMinimumWithdrawal)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [b"merchant", merchant.entity_name.as_str().as_bytes(), owner.key().as_ref()], 
        bump = merchant.merchant_bump,
    )]
    pub merchant: Box<Account<'info, Merchant>>,

    #[account(mut, 
        seeds = [b"vault", merchant.key().as_ref()], 
        bump = merchant.vault_bump,
        constraint = vault.lamports() >= amount @ CustomError::InsufficientFunds)]
    pub vault: SystemAccount<'info>,

    /// CHECK: This is the HOUSE Squads multi-sig
    #[account(mut, constraint = house.key() == Pubkey::from_str(HOUSE).unwrap())]
    pub house: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> WithdrawSol<'info> {
    pub fn withdraw_sol(&mut self, amount: u64) -> Result<()> {
        // Calculate shares using basis points for better precision
        let owner_amount = amount
            .checked_mul(OWNER_SHARE_BASIS_POINTS)
            .ok_or(CustomError::ArithmeticOverflow)?
            .checked_div(BASIS_POINTS_DIVISOR)
            .ok_or(CustomError::ArithmeticOverflow)?;
            
        let house_amount = amount
            .checked_mul(HOUSE_SHARE_BASIS_POINTS)
            .ok_or(CustomError::ArithmeticOverflow)?
            .checked_div(BASIS_POINTS_DIVISOR)
            .ok_or(CustomError::ArithmeticOverflow)?;

        // Validate amounts
        require!(owner_amount > 0, CustomError::InvalidWithdrawalAmount);
        require!(house_amount > 0, CustomError::InvalidWithdrawalAmount);
        require!(owner_amount.checked_add(house_amount).unwrap() <= amount, CustomError::ArithmeticOverflow);

        // Transfer to owner
        self.transfer_from_vault(&self.owner.to_account_info(), owner_amount)?;

        // Transfer to house
        self.transfer_from_vault(&self.house.to_account_info(), house_amount)?;

        // Emit event
        emit!(WithdrawSolProcessed {
            amount,
            owner_amount,
            house_amount,
        });

        Ok(())
    }

    /// Helper function to reduce code duplication
    fn transfer_from_vault(&self, to: &AccountInfo<'info>, amount: u64) -> Result<()> {
        let cpi_accounts = Transfer {
            from: self.vault.to_account_info(),
            to: to.clone(),
        };

        let seeds = &[
            b"vault",
            self.merchant.to_account_info().key.as_ref(),
            &[self.merchant.vault_bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            self.system_program.to_account_info(),
            cpi_accounts,
            signer
        );

        transfer(cpi_ctx, amount)
    }
}