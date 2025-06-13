use anchor_lang::prelude::*;
use crate::state::Merchant;
use crate::errors::*;

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::TokenInterface,
};

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
            fee_eligible: false,
            merchant_bump: bumps.merchant,
            vault_bump: bumps.vault,
        });
        Ok(())
    }
}