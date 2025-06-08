use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};
use std::str::FromStr;

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::constants::*;
use crate::errors::*;
use crate::state::*;
use crate::events::*;

const OWNER_SHARE_BASIS_POINTS: u64 = 9900; // 99%
const HOUSE_SHARE_BASIS_POINTS: u64 = 100;  // 1%
const BASIS_POINTS_DIVISOR: u64 = 10000;
const MINIMUM_WITHDRAWAL_SOL_LAMPORTS: u64 = 1000; // 1000 lamports = 0.000001 SOL
const MINIMUM_WITHDRAWAL_SPL_UNITS: u64 = 100; // 100 units = 0.0001 USDC (6 decimals)

#[derive(Accounts)]
#[instruction(name: String)]
pub struct CreateMerchant<'info> {
    #[account(mut, constraint = !name.trim().is_empty() && name.len() <= 32 @ CustomError::InvalidMerchantName)]
    pub owner: Signer<'info>,

    #[account(init, payer = owner, seeds = [b"merchant", name.as_str().as_bytes(), owner.key().as_ref()], space = Merchant::LEN, bump)]
    pub merchant: Box<Account<'info, Merchant>>,

    #[account(mut, seeds = [b"vault", merchant.key().as_ref()], bump)]
    pub vault: SystemAccount<'info>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> CreateMerchant<'info> {
    pub fn init(&mut self, bumps: &CreateMerchantBumps, name: String) -> Result<()> {
        let trimmed_name = name.trim().to_string();
        let mut entity_name = [0u8; 32];
        entity_name[..trimmed_name.len().min(32)].copy_from_slice(trimmed_name.as_bytes());
        
        self.merchant.set_inner(Merchant {
            owner: self.owner.key(),
            entity_name: trimmed_name,
            fee_eligible: true,
            merchant_bump: bumps.merchant,
            vault_bump: bumps.vault,
        });
        Ok(())
    }
}

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

    #[account(mut,
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
        emit!(WithdrawalSplProcessed {
            amount,
            owner_amount,
            house_amount,
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
        constraint = vault.lamports() >= amount @ CustomError::InsufficientFunds,
        constraint = vault.lamports().checked_sub(amount).unwrap() >= Rent::get()?.minimum_balance(0) @ CustomError::InsufficientRentBalance)]
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
        emit!(WithdrawalSolProcessed {
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

#[derive(Accounts)]
#[instruction(original_tx_sig: String, amount: u64)]
pub struct RefundSpl<'info> {
    #[account(mut, 
        constraint = amount > 0 @ CustomError::ZeroAmountRefund)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [b"merchant", merchant.entity_name.as_str().as_bytes(), owner.key().as_ref()], 
        bump = merchant.merchant_bump)]
    pub merchant: Box<Account<'info, Merchant>>,

    pub stablecoin_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut,
        associated_token::mint = stablecoin_mint,
        associated_token::authority = merchant,
        constraint = merchant_stablecoin_ata.amount >= amount @ CustomError::InsufficientFunds)]
    pub merchant_stablecoin_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(init_if_needed, 
        payer = owner,
        associated_token::mint = stablecoin_mint,
        associated_token::authority = recipient)]
    pub recipient_stablecoin_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init,
        payer = owner,
        seeds = [b"refund", original_tx_sig.as_bytes()],
        space = RefundRecord::LEN,
        bump
    )]
    pub refund_record: Box<Account<'info, RefundRecord>>,

    /// CHECK: this is the public key of address you are refunding, to derive their stablecoin ata
    pub recipient: AccountInfo<'info>,
    
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> RefundSpl<'info> {
    pub fn refund_spl(&mut self, original_tx_sig: String, amount: u64, bumps: &RefundSplBumps) -> Result<()> {
        
        // Initialize refund record
        self.refund_record.set_inner(RefundRecord {
            original_tx_sig: original_tx_sig.clone(),
            bump: bumps.refund_record
        });

        let owner_key = self.owner.key();
        let seeds = &[
            b"merchant".as_ref(),
            self.merchant.entity_name.as_bytes(),
            owner_key.as_ref(),
            &[self.merchant.merchant_bump],
        ];

        // Transfer the refund amount back to the recipient
        anchor_spl::token_interface::transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                anchor_spl::token_interface::TransferChecked {
                    from: self.merchant_stablecoin_ata.to_account_info(),
                    mint: self.stablecoin_mint.to_account_info(),
                    to: self.recipient_stablecoin_ata.to_account_info(),
                    authority: self.merchant.to_account_info(),
                },
                &[seeds],
            ),
            amount,
            self.stablecoin_mint.decimals,
        )?;

        // Emit event
        emit!(RefundProcessed {
            original_tx_sig,
            amount,
            recipient: self.recipient.key()
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(original_tx_sig: String, amount: u64)]
pub struct RefundSol<'info> {
    #[account(mut, 
        constraint = amount > 0 @ CustomError::ZeroAmountRefund)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [b"merchant", merchant.entity_name.as_str().as_bytes(), owner.key().as_ref()], 
        bump = merchant.merchant_bump)]
    pub merchant: Box<Account<'info, Merchant>>,

    #[account(mut, 
        seeds = [b"vault", merchant.key().as_ref()], 
        bump = merchant.vault_bump,
        constraint = vault.lamports() >= amount @ CustomError::InsufficientFunds,
        constraint = vault.lamports().checked_sub(amount).unwrap() >= Rent::get()?.minimum_balance(0) @ CustomError::InsufficientRentBalance)]
    pub vault: SystemAccount<'info>,

    #[account(
        init,
        payer = owner,
        seeds = [b"refund", original_tx_sig.as_bytes()],
        space = RefundRecord::LEN,
        bump
    )]
    pub refund_record: Box<Account<'info, RefundRecord>>,

    /// CHECK: this is the public key of address you are refunding
    #[account(mut)]
    pub recipient: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> RefundSol<'info> {
    pub fn refund_sol(&mut self, original_tx_sig: String, amount: u64, bumps: &RefundSolBumps) -> Result<()> {
        
        // Initialize refund record
        self.refund_record.set_inner(RefundRecord {
            original_tx_sig: original_tx_sig.clone(),
            bump: bumps.refund_record
        });

        // Transfer the full refund amount to the recipient (100% - no house fee for refunds)
        let cpi_accounts = Transfer {
            from: self.vault.to_account_info(),
            to: self.recipient.to_account_info(),
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

        transfer(cpi_ctx, amount)?;

        // Emit event
        emit!(RefundProcessed {
            original_tx_sig,
            amount,
            recipient: self.recipient.key()
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct SetMerchantStatus<'info> {
    /// CHECK: This is the HOUSE Squads multi-sig that must sign
    #[account(mut, constraint = auth.key() == Pubkey::from_str(AUTH).unwrap() @ CustomError::UnauthorizedStatusChange)]
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

#[derive(Accounts)]
pub struct CloseMerchant<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut, 
        seeds = [b"merchant", merchant.entity_name.as_str().as_bytes(), owner.key().as_ref()], 
        bump = merchant.merchant_bump,
        close = owner)]
    pub merchant: Box<Account<'info, Merchant>>,

    pub system_program: Program<'info, System>,
}

impl<'info> CloseMerchant<'info> {
    pub fn close_merchant(&mut self) -> Result<()> {

        // Emit event for Merchant closure
        emit!(MerchantClosed {
            merchant: self.merchant.key(),
            entity_name: self.merchant.entity_name.clone()
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction()]
pub struct CloseRefund<'info> {
    #[account(mut, constraint = auth.key() == Pubkey::from_str(AUTH).unwrap())]
    pub auth: Signer<'info>,

    #[account(mut, close = auth)]
    pub refund_record: Box<Account<'info, RefundRecord>>,

    pub system_program: Program<'info, System>,
}

impl<'info> CloseRefund<'info> {
    pub fn close_refund(&mut self) -> Result<()> {
        Ok(())
    }
}