use anchor_lang::prelude::*;

#[account]
pub struct Merchant {
    pub owner: Pubkey,
    pub entity_name: String,
    pub fee_eligible: bool,
    pub merchant_bump: u8,
}

impl Merchant {
    pub const LEN: usize = 8 + 32 + (4 + 32) + 1 + 1;
}

#[account]
pub struct RefundRecord {
    pub original_tx_sig: String,
    pub bump: u8,
}

impl RefundRecord {
    pub const LEN: usize = 8 + (4 + 32) + 1;
}