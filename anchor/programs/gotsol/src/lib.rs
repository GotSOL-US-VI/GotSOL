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

    pub fn refund_spl(ctx: Context<RefundSpl>, original_tx_sig: String, amount: u64) -> Result<()> {
        ctx.accounts.refund_spl(original_tx_sig, amount, &ctx.bumps)?;
        Ok(())
    }

    pub fn refund_sol(ctx: Context<RefundSol>, original_tx_sig: String, amount: u64) -> Result<()> {
        ctx.accounts.refund_sol(original_tx_sig, amount, &ctx.bumps)?;
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

    pub fn create_contacts(ctx: Context<CreateContacts>) -> Result<()> {
        ctx.accounts.create_contacts(&ctx.bumps)?;
        Ok(())
    }

    pub fn close_contacts(ctx: Context<CloseContacts>) -> Result<()> {
        ctx.accounts.close_contacts(&ctx.bumps)?;
        Ok(())
    }

    pub fn append_contacts(ctx: Context<EditContacts>, contact: Pubkey) -> Result<()> {
        ctx.accounts.append_contact(contact)?;
        Ok(())
    }

    pub fn delete_from_contacts(ctx: Context<EditContacts>, contact: Pubkey) -> Result<()> {
        ctx.accounts.remove_contact(contact)?;
        Ok(())
    }

    pub fn send_spl_to_contacts(ctx: Context<SendSplToContacts>, recipients: Vec<(Pubkey, u64)>) -> Result<()> {
        ctx.accounts.send_spl_to_contacts(recipients)?;
        Ok(())
    }

    pub fn send_sol_to_contacts(ctx: Context<SendSolToContacts>, recipients: Vec<(Pubkey, u64)>) -> Result<()> {
        ctx.accounts.send_sol_to_contacts(recipients)?;
        Ok(())
    }

    pub fn send_spl(ctx: Context<SendSpl>, amount: u64) -> Result<()> {
        ctx.accounts.send_spl(amount)?;
        Ok(())
    }

    pub fn send_sol(ctx: Context<SendSol>, amount: u64) -> Result<()> {
        ctx.accounts.send_sol(amount)?;
        Ok(())
    }
}