use anchor_lang::prelude::*;
use crate::state::RefundRecord;
use crate::constants::*;

use std::str::FromStr;

#[derive(Accounts)]
#[instruction()]
pub struct CloseRefund<'info> {
    #[account(mut, constraint = auth.key() == Pubkey::from_str(AUTH_2).unwrap() || auth.key() == Pubkey::from_str(AUTH_3).unwrap())]
    pub auth: Signer<'info>,

    #[account(mut, close = auth)]
    pub refund_record: Box<Account<'info, RefundRecord>>,

    pub system_program: Program<'info, System>,
}

impl<'info> CloseRefund<'info> {
    pub fn close_refund(&mut self) -> Result<()> {
        Ok(())
    }
}