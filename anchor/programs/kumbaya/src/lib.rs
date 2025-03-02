#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;

mod constants;
mod context;
mod errors;
mod state;

use crate::context::*;

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
}
