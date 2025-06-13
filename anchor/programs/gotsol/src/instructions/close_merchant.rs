use anchor_lang::prelude::*;
use crate::state::Merchant;
use crate::events::*;

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