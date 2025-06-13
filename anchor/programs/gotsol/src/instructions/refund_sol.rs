use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};
use crate::state::Merchant;
use crate::state::RefundRecord;
use crate::errors::*;
use crate::events::*;

#[derive(Accounts)]
#[instruction(original_tx_sig: String, amount: u64)]
pub struct RefundSol<'info> {

    // our node's fee payer
    #[account(mut)]
    pub fee_payer: Option<Signer<'info>>,

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
        constraint = vault.lamports() >= amount @ CustomError::InsufficientFunds)]
    pub vault: SystemAccount<'info>,

    #[account(
        init,
        payer = fee_payer.as_ref().unwrap_or(&owner),
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