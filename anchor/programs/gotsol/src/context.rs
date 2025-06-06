use anchor_lang::prelude::*;
use std::str::FromStr;

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::constants::*;
use crate::errors::*;
use crate::state::*;
use crate::events::*;

#[derive(Accounts)]
#[instruction(name: String)]
pub struct CreateMerchant<'info> {
    #[account(mut, constraint = !name.trim().is_empty() && name.len() <= 32 @ CustomError::InvalidMerchantName)]
    pub owner: Signer<'info>,

    #[account(init, payer = owner, seeds = [b"merchant", name.as_str().as_bytes(), owner.key().as_ref()], space = Merchant::LEN, bump)]
    pub merchant: Box<Account<'info, Merchant>>,

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
        });
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct Withdraw<'info> {
    #[account(mut,
    constraint = amount > 0 @ CustomError::ZeroAmountWithdrawal,
    constraint = amount >= 100 @ CustomError::BelowMinimumWithdrawal)]  // 100 raw units ensures house gets 1 raw unit (1%) with 99/1 split
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

impl<'info> Withdraw<'info> {
    pub fn withdraw(&mut self, amount: u64) -> Result<()> {
        // Use checked math operations to prevent overflow/underflow
        let owner_amount = amount
            .checked_mul(OWNER_SHARE)
            .ok_or(CustomError::ArithmeticOverflow)?
            .checked_div(1000)
            .ok_or(CustomError::ArithmeticOverflow)?;
            
        let house_amount = amount
            .checked_sub(owner_amount)
            .ok_or(CustomError::ArithmeticOverflow)?;

        let owner_key = self.owner.key();
        let seeds = &[
            b"merchant".as_ref(),
            self.merchant.entity_name.as_bytes(),
            owner_key.as_ref(),
            &[self.merchant.merchant_bump],
        ];

        // Transfer the owner's share
        anchor_spl::token_interface::transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                anchor_spl::token_interface::TransferChecked {
                    from: self.merchant_stablecoin_ata.to_account_info(),
                    mint: self.stablecoin_mint.to_account_info(),
                    to: self.owner_stablecoin_ata.to_account_info(),
                    authority: self.merchant.to_account_info(),
                },
                &[seeds],
            ),
            owner_amount,
            self.stablecoin_mint.decimals,
        )?;

        // Transfer house's share
        anchor_spl::token_interface::transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                anchor_spl::token_interface::TransferChecked {
                    from: self.merchant_stablecoin_ata.to_account_info(),
                    mint: self.stablecoin_mint.to_account_info(),
                    to: self.house_stablecoin_ata.to_account_info(),
                    authority: self.merchant.to_account_info(),
                },
                &[seeds],
            ),
            house_amount,
            self.stablecoin_mint.decimals,
        )?;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(original_tx_sig: String, amount: u64)]
pub struct RefundPayment<'info> {
    #[account(mut, 
        constraint = amount > 0 @ CustomError::ZeroAmountWithdrawal)]
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

impl<'info> RefundPayment<'info> {
    pub fn refund(&mut self, original_tx_sig: String, amount: u64, bumps: &RefundPaymentBumps) -> Result<()> {
        
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
            merchant: self.merchant.key()
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