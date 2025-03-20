#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;

mod constants;
mod context;
mod errors;
mod events;
mod state;

use crate::context::*;
use crate::state::EmployeeRole;
use crate::events::{EmployeeCreated, EmployeeUpdated, EmployeeWithdrawal};

declare_id!("RKAxBK5mBxYta3FUfMLHafMj8xakd8PLsH3PXFa773r");

#[program]
pub mod kumbaya {
    use super::*;

    pub fn init_global(ctx: Context<InitGlobal>) -> Result<()> {
        ctx.accounts.init(&ctx.bumps)?;
        Ok(())
    }

    pub fn create_merchant(ctx: Context<CreateMerchant>, name: String) -> Result<()> {
        ctx.accounts.init(&ctx.bumps, name)?;
        Ok(())
    }

    pub fn withdraw_usdc(ctx: Context<WithdrawUSDC>, amount: u64) -> Result<()> {
        ctx.accounts.withdraw(amount)?;
        Ok(())
    }

    pub fn refund(ctx: Context<RefundPayment>, original_tx_sig: String, amount: u64) -> Result<()> {
        ctx.accounts.refund(original_tx_sig, amount, &ctx.bumps)?;
        Ok(())
    }

    pub fn create_employee(ctx: Context<CreateEmployee>, name: String, role: EmployeeRole) -> Result<()> {
        ctx.accounts.init(&ctx.bumps, name.clone(), role)?;

        emit!(EmployeeCreated {
            merchant: ctx.accounts.merchant.key(),
            employee: ctx.accounts.employee_pubkey.key(),
            role: format!("{:?}", role),
            name,
        });

        Ok(())
    }

    pub fn update_employee(ctx: Context<UpdateEmployee>, role: Option<EmployeeRole>, is_active: Option<bool>) -> Result<()> {
        ctx.accounts.update(role, is_active)?;

        emit!(EmployeeUpdated {
            merchant: ctx.accounts.merchant.key(),
            employee: ctx.accounts.employee.employee_pubkey,
            new_role: role.map(|r| format!("{:?}", r)),
            is_active,
        });

        Ok(())
    }

    pub fn employee_withdraw(ctx: Context<EmployeeWithdrawUSDC>, amount: u64) -> Result<()> {
        ctx.accounts.withdraw(amount)?;

        emit!(EmployeeWithdrawal {
            merchant: ctx.accounts.merchant.key(),
            employee: ctx.accounts.employee_signer.key(),
            amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}
