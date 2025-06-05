#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;

mod constants;
mod context;
mod errors;
mod events;
mod state;

use crate::context::*;
// use crate::state::{EmployeeRole, RoleLimits};
// use crate::events::{EmployeeCreated, EmployeeUpdated, EmployeeWithdrawal, RevenuePayment};

declare_id!("7E9eu4fZdpQ1LyrwyBGxcFumDfGdGRw7YSQvZvnLaeLN");

#[program]
pub mod gotsol {
    use super::*;

    pub fn create_merchant(ctx: Context<CreateMerchant>, name: String) -> Result<()> {
        ctx.accounts.init(&ctx.bumps, name)?;
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
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

    pub fn close_merchant(ctx: Context<CloseMerchant>) -> Result<()> {
        ctx.accounts.close_merchant()?;
        Ok(())
    }

    pub fn close_refund(ctx: Context<CloseRefund>) -> Result<()> {
        ctx.accounts.close_refund()?;
        Ok(())
    }
}