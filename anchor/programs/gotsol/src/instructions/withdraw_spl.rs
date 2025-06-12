use anchor_lang::prelude::*;

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use std::str::FromStr;

use crate::state::Merchant;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;

const OWNER_SHARE_BASIS_POINTS: u64 = 9900; // 99%
const HOUSE_SHARE_BASIS_POINTS: u64 = 100;  // 1%
const BASIS_POINTS_DIVISOR: u64 = 10000;
// const MINIMUM_WITHDRAWAL_SOL_LAMPORTS: u64 = 1000; // 1000 lamports = 0.000001 SOL
const MINIMUM_WITHDRAWAL_SPL_UNITS: u64 = 100; 

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct WithdrawSpl<'info> {
    #[account(mut,
        constraint = amount >= MINIMUM_WITHDRAWAL_SPL_UNITS @ CustomError::BelowMinimumWithdrawal)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [b"merchant", merchant.entity_name.as_str().as_bytes(), owner.key().as_ref()], 
        bump = merchant.merchant_bump,
    )]
    pub merchant: Box<Account<'info, Merchant>>,

    pub stablecoin_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut,
        associated_token::mint = stablecoin_mint,
        associated_token::authority = merchant,
        constraint = merchant_stablecoin_ata.amount >= amount @ CustomError::InsufficientFunds,
    )]
    pub merchant_stablecoin_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(init_if_needed, 
        payer = owner,
        associated_token::mint = stablecoin_mint,
        associated_token::authority = owner
    )]
    pub owner_stablecoin_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: This is the HOUSE Squads multi-sig
    #[account(constraint = house.key() == Pubkey::from_str(HOUSE).unwrap())]
    pub house: AccountInfo<'info>,

    #[account(init_if_needed, payer = owner,
        associated_token::mint = stablecoin_mint,
        associated_token::authority = house
    )]
    pub house_stablecoin_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> WithdrawSpl<'info> {
    pub fn withdraw_spl(&mut self, amount: u64) -> Result<()> {
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

        let owner_key = self.owner.key();
        let seeds = &[
            b"merchant".as_ref(),
            self.merchant.entity_name.as_bytes(),
            owner_key.as_ref(),
            &[self.merchant.merchant_bump],
        ];

        // Transfer the owner's share
        self.transfer_spl_tokens(&self.owner_stablecoin_ata.to_account_info(), owner_amount, seeds)?;

        // Transfer house's share
        self.transfer_spl_tokens(&self.house_stablecoin_ata.to_account_info(), house_amount, seeds)?;

        // Emit event
        emit!(WithdrawSplProcessed {
            amount,
            owner_amount,
            house_amount,
            mint: self.stablecoin_mint.key(),
        });

        Ok(())
    }

    /// Helper function to reduce code duplication for SPL token transfers
    fn transfer_spl_tokens(&self, to: &AccountInfo<'info>, amount: u64, seeds: &[&[u8]]) -> Result<()> {
        anchor_spl::token_interface::transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                anchor_spl::token_interface::TransferChecked {
                    from: self.merchant_stablecoin_ata.to_account_info(),
                    mint: self.stablecoin_mint.to_account_info(),
                    to: to.clone(),
                    authority: self.merchant.to_account_info(),
                },
                &[seeds],
            ),
            amount,
            self.stablecoin_mint.decimals,
        )
    }
}