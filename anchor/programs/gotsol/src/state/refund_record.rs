use anchor_lang::prelude::*;

pub const MAX_TX_SIG_LEN: usize = 88; // Base58 signature length

#[account]
pub struct RefundRecord {
    pub original_tx_sig: String,
    pub bump: u8,
}

impl RefundRecord {
    pub const LEN: usize = 8 + (4 + MAX_TX_SIG_LEN) + 1;
}