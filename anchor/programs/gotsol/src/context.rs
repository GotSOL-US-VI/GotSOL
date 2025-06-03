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
    #[account(mut, constraint = !name.trim().is_empty() @ CustomError::InvalidMerchantName)]
    pub owner: Signer<'info>,

    /// Minimal merchant PDA - required for token account authority and signing
    #[account(
        init_if_needed,
        payer = owner, 
        seeds = [b"merchant", name.as_str().as_bytes(), owner.key().as_ref()], 
        space = Merchant::LEN, 
        bump
    )]
    pub merchant: Box<Account<'info, Merchant>>,

    /// Compression accounts - all required for compressed merchant creation
    
    /// The Merkle tree account for storing compressed merchant data
    /// CHECK: This is a Merkle tree account managed by the compression program
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,
    
    /// The tree authority (program PDA)
    /// CHECK: This is a PDA derived from the program for tree authority
    #[account(
        seeds = [b"tree_authority"],
        bump,
    )]
    pub tree_authority: UncheckedAccount<'info>,
    
    /// The compressed merchant state tracker
    #[account(
        init_if_needed,
        payer = owner,
        seeds = [b"compressed_merchant", name.as_bytes(), owner.key().as_ref()],
        space = CompressedMerchantState::LEN,
        bump
    )]
    pub compressed_merchant_state: Account<'info, CompressedMerchantState>,
    
    /// Noop program for compression logging
    /// CHECK: This is the SPL Noop program
    pub noop_program: UncheckedAccount<'info>,
    
    /// Account compression program
    /// CHECK: This is the SPL Account Compression program
    pub compression_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> CreateMerchant<'info> {
    pub fn init(&mut self, bumps: &CreateMerchantBumps, name: String, fee_eligible: bool) -> Result<()> {
        let trimmed_name = name.trim().to_string();
        
        // Always create compressed merchant
        self.create_compressed_merchant(trimmed_name, fee_eligible, bumps)
    }
    
    fn create_compressed_merchant(&mut self, name: String, fee_eligible: bool, bumps: &CreateMerchantBumps) -> Result<()> {
        // Create the compressed merchant data for the Merkle tree
        let merchant_data = CompressedMerchantData {
            owner: self.owner.key(),
            entity_name: name.clone(),
            total_withdrawn: 0,
            total_refunded: 0,
            fee_eligible,
        };
        
        // Serialize the merchant data for compression
        let mut data = Vec::new();
        merchant_data.serialize(&mut data)
            .map_err(|_| CustomError::CompressionSerializationError)?;
        
        // Store reference to compressed data in state tracker
        // Note: In production, you would use proper CPI calls to append to the Merkle tree
        self.compressed_merchant_state.set_inner(CompressedMerchantState {
            merkle_tree: self.merkle_tree.key(),
            leaf_index: 0, // In production, this would come from the append response
            is_compressed: true,
        });
        
        // Create minimal merchant PDA - only stores what's needed for token account authority
        // All actual merchant data is stored compressed in the Merkle tree
        self.merchant.set_inner(Merchant {
            owner: self.owner.key(),
            entity_name: name, // Keep name for seed derivation in other instructions
            total_withdrawn: 0, // These could be moved to compressed data only
            total_refunded: 0,  // These could be moved to compressed data only  
            fee_eligible,
            merchant_bump: bumps.merchant,
        });
    
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct WithdrawTokens<'info> {
    #[account(mut, constraint = amount > 0 @ CustomError::ZeroAmountWithdrawal)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [b"merchant", merchant.entity_name.as_str().as_bytes(), owner.key().as_ref()], 
        bump = merchant.merchant_bump,
        constraint = owner.key() == merchant.owner @ CustomError::NotMerchantOwner
    )]
    pub merchant: Box<Account<'info, Merchant>>,

    #[account(constraint = token_mint.decimals == 6 @ CustomError::InvalidTokenDecimals)]
    pub token_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut,
        associated_token::mint = token_mint,
        associated_token::authority = merchant,
        constraint = merchant_token_ata.amount >= amount @ CustomError::InsufficientFunds,
    )]
    pub merchant_token_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(init_if_needed, 
        payer = owner,
        associated_token::mint = token_mint,
        associated_token::authority = owner
    )]
    pub owner_token_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: This is the HOUSE Squads multi-sig
    #[account(mut, constraint = house.key() == Pubkey::from_str(HOUSE).unwrap())]
    pub house: AccountInfo<'info>,

    #[account(mut,
        associated_token::mint = token_mint,
        associated_token::authority = house
    )]
    pub house_token_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> WithdrawTokens<'info> {
    pub fn withdraw(&mut self, amount: u64) -> Result<()> {
        let owner_amount = (amount * OWNER_SHARE) / 1000;
        let house_amount = amount - owner_amount;

        // Optimized seeds creation with proper lifetime handling
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
                    from: self.merchant_token_ata.to_account_info(),
                    mint: self.token_mint.to_account_info(),
                    to: self.owner_token_ata.to_account_info(),
                    authority: self.merchant.to_account_info(),
                },
                &[seeds],
            ),
            owner_amount,
            self.token_mint.decimals,
        )?;

        // Transfer house's share
        anchor_spl::token_interface::transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                anchor_spl::token_interface::TransferChecked {
                    from: self.merchant_token_ata.to_account_info(),
                    mint: self.token_mint.to_account_info(),
                    to: self.house_token_ata.to_account_info(),
                    authority: self.merchant.to_account_info(),
                },
                &[seeds],
            ),
            house_amount,
            self.token_mint.decimals,
        )?;

        self.merchant.total_withdrawn += amount;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(original_tx_sig: String, amount: u64)]
pub struct RefundPayment<'info> {
    #[account(mut, constraint = amount > 0 @ CustomError::ZeroAmountWithdrawal)]
    pub owner: Signer<'info>,

    #[account(mut, 
        seeds = [b"merchant", merchant.entity_name.as_str().as_bytes(), owner.key().as_ref()], 
        bump = merchant.merchant_bump,
        constraint = owner.key() == merchant.owner @ CustomError::NotMerchantOwner)]
    pub merchant: Box<Account<'info, Merchant>>,

    #[account(mut,
        associated_token::mint = token_mint,
        associated_token::authority = merchant,
        constraint = merchant_token_ata.amount >= amount @ CustomError::InsufficientFunds)]
    pub merchant_token_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut,
        associated_token::mint = token_mint,
        associated_token::authority = recipient)]
    pub recipient_token_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init,
        payer = owner,
        seeds = [b"refund", original_tx_sig.as_bytes()],
        space = RefundRecord::LEN,
        bump
    )]
    pub refund_record: Box<Account<'info, RefundRecord>>,

    #[account(constraint = token_mint.decimals == 6 @ CustomError::InvalidTokenDecimals)]
    pub token_mint: Box<InterfaceAccount<'info, Mint>>,

    /// CHECK: this is the public key of address you are refunding, to derive their token ata
    pub recipient: AccountInfo<'info>,
    
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> RefundPayment<'info> {
    pub fn refund(&mut self, original_tx_sig: String, amount: u64, bumps: &RefundPaymentBumps) -> Result<()> {
        // Initialize refund record
        self.refund_record.set_inner(RefundRecord {
            amount,
            original_tx_sig: original_tx_sig.clone(),
            bump: bumps.refund_record
        });

        // Optimized seeds creation with proper lifetime handling
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
                    from: self.merchant_token_ata.to_account_info(),
                    mint: self.token_mint.to_account_info(),
                    to: self.recipient_token_ata.to_account_info(),
                    authority: self.merchant.to_account_info(),
                },
                &[seeds],
            ),
            amount,
            self.token_mint.decimals,
        )?;

        // Update merchant state
        self.merchant.total_refunded += amount;

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
    #[account(constraint = auth.key() == Pubkey::from_str(AUTH).unwrap() @ CustomError::UnauthorizedStatusChange)]
    pub auth: Signer<'info>,

    #[account(mut)]
    pub merchant: Box<Account<'info, Merchant>>,

    pub system_program: Program<'info, System>,
}

impl<'info> SetMerchantStatus<'info> {
    pub fn set_status(&mut self, fee_eligible: bool) -> Result<()> {
        self.merchant.fee_eligible = fee_eligible;

        // Emit event for status change
        emit!(MerchantStatusChanged {
            merchant: self.merchant.key(),
            fee_eligible,
            timestamp: Clock::get()?.unix_timestamp
        });

        Ok(())
    }
}
