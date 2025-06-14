use anchor_lang::prelude::*;
use crate::state::Merchant;
use crate::events::*;
use crate::errors::*;
use crate::constants::*;

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use std::str::FromStr;

const OWNER_SHARE_BASIS_POINTS: u64 = 9400; // 94%
const COMPLIANCE_SHARE_BASIS_POINTS: u64 = 500; // 5%
const HOUSE_SHARE_BASIS_POINTS: u64 = 100;  // 1%
const BASIS_POINTS_DIVISOR: u64 = 10000;

/* 
THIS IS A TEMPORARY CONTEXT AND WILL BE DELETED/REFACTORED LATER ONCE WE DON'T NEED IT ANYMORE!
94/5/1 fee split between Owner, compliance_escrow, and House 
We are going to call this on this front end if we are withdrawing USDC, just so we can 
create a working proof of concept to show potential funding sources
*/

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct WithdrawUSDC<'info> {

    // our node's fee payer
    #[account(mut)]
    pub fee_payer: Option<Signer<'info>>,

    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(seeds = [b"merchant", merchant.entity_name.as_str().as_bytes(), owner.key().as_ref()], bump = merchant.merchant_bump)]
    pub merchant: Box<Account<'info, Merchant>>,

    #[account(constraint = usdc_mint.key() == Pubkey::from_str(USDC_DEVNET_MINT).unwrap())]
    pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = merchant,
        constraint = merchant_usdc_ata.amount >= amount @ CustomError::InsufficientFunds,
    )]
    pub merchant_usdc_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [b"compliance_escrow", merchant.key().as_ref()],
        bump = merchant.compliance_bump,
        token::mint = usdc_mint,
        token::authority = merchant
    )]
    pub compliance_escrow: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(init_if_needed, payer = fee_payer.as_ref().unwrap_or(&owner),
        associated_token::mint = usdc_mint,
        associated_token::authority = owner
    )]
    pub owner_usdc_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: This is the HOUSE Squads multi-sig
    #[account(constraint = house.key() == Pubkey::from_str(HOUSE).unwrap())]
    pub house: AccountInfo<'info>,

    #[account(init_if_needed, payer = fee_payer.as_ref().unwrap_or(&owner),
        associated_token::mint = usdc_mint,
        associated_token::authority = house
    )]
    pub house_usdc_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> WithdrawUSDC<'info> {
    pub fn withdraw(&mut self, amount: u64) -> Result<()> {

        // Calculate shares using basis points for better precision
        let owner_amount = amount
            .checked_mul(OWNER_SHARE_BASIS_POINTS)
            .ok_or(CustomError::ArithmeticOverflow)?
            .checked_div(BASIS_POINTS_DIVISOR)
            .ok_or(CustomError::ArithmeticOverflow)?;
            
        let compliance_amount = amount
            .checked_mul(COMPLIANCE_SHARE_BASIS_POINTS)
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
        require!(compliance_amount > 0, CustomError::InvalidWithdrawalAmount);
        require!(house_amount > 0, CustomError::InvalidWithdrawalAmount);
        require!(owner_amount.checked_add(compliance_amount).unwrap().checked_add(house_amount).unwrap() <= amount, CustomError::ArithmeticOverflow);

        // Optimized seeds creation with proper lifetime handling
        let owner_key = self.owner.key();
        let seeds = &[
            b"merchant".as_ref(),
            self.merchant.entity_name.as_bytes(),
            owner_key.as_ref(),
            &[self.merchant.merchant_bump],
        ];

        // Transfer the owner's share to the owner
        anchor_spl::token_interface::transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                anchor_spl::token_interface::TransferChecked {
                    from: self.merchant_usdc_ata.to_account_info(),
                    mint: self.usdc_mint.to_account_info(),
                    to: self.owner_usdc_ata.to_account_info(),
                    authority: self.merchant.to_account_info(),
                },
                &[seeds],
            ),
            owner_amount,
            self.usdc_mint.decimals,
        )?;

        // Transfer 5% of the withdrawn amount to the merchant's compliance_escrow
        anchor_spl::token_interface::transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                anchor_spl::token_interface::TransferChecked {
                    from: self.merchant_usdc_ata.to_account_info(),
                    mint: self.usdc_mint.to_account_info(),
                    to: self.compliance_escrow.to_account_info(),
                    authority: self.merchant.to_account_info(),
                },
                &[seeds],
            ),
            compliance_amount,
            self.usdc_mint.decimals,
        )?;

        // Transfer 1% of the withdrawn amount to the house
        anchor_spl::token_interface::transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                anchor_spl::token_interface::TransferChecked {
                    from: self.merchant_usdc_ata.to_account_info(),
                    mint: self.usdc_mint.to_account_info(),
                    to: self.house_usdc_ata.to_account_info(),
                    authority: self.merchant.to_account_info(),
                },
                &[seeds],
            ),
            house_amount,
            self.usdc_mint.decimals,
        )?;

        // Emit event
        emit!(WithdrawSplProcessed {
            amount,
            owner_amount,
            house_amount,
            mint: self.usdc_mint.key(),
        });

        Ok(())
    }
}