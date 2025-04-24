#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;

mod constants;
mod context;
mod errors;
mod events;
mod state;

use crate::context::*;
use crate::state::{EmployeeRole, RoleLimits};
use crate::events::{EmployeeCreated, EmployeeUpdated, EmployeeWithdrawal, RevenuePayment};

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

    pub fn make_revenue_payment(ctx: Context<MakeRevenuePayment>) -> Result<()> {
        // Get the amount before making the payment
        let amount = ctx.accounts.compliance_escrow.amount;
        
        // Make the payment
        ctx.accounts.make_revenue_payment(&ctx.bumps)?;
        
        // Emit the event after the payment is made
        emit!(RevenuePayment {
            merchant: ctx.accounts.merchant.key(),
            amount,
            timestamp: Clock::get()?.unix_timestamp,
            lifetime_paid: ctx.accounts.compliance.lifetime_paid,
        });
        
        Ok(())
    }

    pub fn create_employee(
        ctx: Context<CreateEmployee>, 
        name: String, 
        role: EmployeeRole,
        custom_limits: Option<RoleLimits>
    ) -> Result<()> {
        ctx.accounts.init(role, name.clone(), custom_limits)?;

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
