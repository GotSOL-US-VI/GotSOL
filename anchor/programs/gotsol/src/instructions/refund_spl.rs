use anchor_lang::prelude::*;
use crate::state::Merchant;
use crate::state::RefundRecord;
use crate::events::*;
use crate::errors::*;

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

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