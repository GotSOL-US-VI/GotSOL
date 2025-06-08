#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;
use solana_security_txt::security_txt;

mod constants;
mod context;
mod errors;
mod events;
mod state;

use crate::context::*;

declare_id!("E6MRtJg483SVLY7EvryXJXPSLybRZyCCTsDY4BhNQYb");

// Security contact information embedded in the smart contract
#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "GotSOL",
    project_url: "https://gotsol-dev.vercel.app",
    contacts: "email:gotsol-dev@protonmail.com",
    policy: "https://gotsol-dev.vercel.app/security-policy",
    preferred_languages: "en",
    source_code: "https://github.com/GotSOL-US-VI/GotSOL",
    acknowledgements: "https://gotsol-dev.vercel.app/security-acknowledgments"
}

#[program]
pub mod gotsol {
    use super::*;

    pub fn create_merchant(ctx: Context<CreateMerchant>, name: String) -> Result<()> {
        ctx.accounts.init(&ctx.bumps, name)?;
        Ok(())
    }

    pub fn withdraw_spl(ctx: Context<WithdrawSpl>, amount: u64) -> Result<()> {
        ctx.accounts.withdraw_spl(amount)?;
        Ok(())
    }

    pub fn withdraw_sol(ctx: Context<WithdrawSol>, amount: u64) -> Result<()> {
        ctx.accounts.withdraw_sol(amount)?;
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