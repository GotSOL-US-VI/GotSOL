use anchor_lang::prelude::*;

#[event]
pub struct RefundProcessed {
    pub original_tx_sig: String,
    pub amount: u64,
    pub recipient: Pubkey,
}

#[event]
pub struct MerchantStatusChanged {
    pub merchant: Pubkey,
    pub fee_eligible: bool,
    pub timestamp: i64,
}
