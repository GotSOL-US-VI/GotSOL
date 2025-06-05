use anchor_lang::prelude::*;
// use crate::constants::*;

#[account]
pub struct Merchant {
    pub entity_name: String,
    pub fee_eligible: bool,
    pub merchant_bump: u8,
}

impl Merchant {
    pub const LEN: usize = 8 + (4 + 32) + 1 + 1;
}

#[account]
pub struct RefundRecord {
    pub amount: u64,
    pub original_tx_sig: String,
    pub bump: u8,
}

impl RefundRecord {
    pub const LEN: usize = 8 + 8 + (4 + 32) + 1;
}