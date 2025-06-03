#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;

mod constants;
mod context;
mod errors;
mod events;
mod state;

use crate::context::*;

declare_id!("RKAxBK5mBxYta3FUfMLHafMj8xakd8PLsH3PXFa773r");

#[program]
pub mod gotsol {
    use super::*;

    pub fn create_merchant(ctx: Context<CreateMerchant>, name: String, fee_eligible: bool) -> Result<()> {
        ctx.accounts.init(&ctx.bumps, name, fee_eligible)?;
        Ok(())
    }

    pub fn withdraw_tokens(ctx: Context<WithdrawTokens>, amount: u64) -> Result<()> {
        ctx.accounts.withdraw(amount)?;
        Ok(())
    }

    pub fn refund(ctx: Context<RefundPayment>, original_tx_sig: String, amount: u64) -> Result<()> {
        ctx.accounts.refund(original_tx_sig, amount, &ctx.bumps)?;
        Ok(())
    }

    pub fn set_merchant_status(ctx: Context<SetMerchantStatus>, fee_eligible: bool) -> Result<()> {
        ctx.accounts.set_status(fee_eligible)?;
        Ok(())
    }
}