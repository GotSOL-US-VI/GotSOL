use anchor_lang::prelude::*;

#[event]
pub struct RefundProcessed {
    pub original_tx_sig: String,
    pub amount: u64,
    pub recipient: Pubkey,
}

#[event]
pub struct MerchantClosed {
    pub merchant: Pubkey,
    pub entity_name: String,
}

#[event]
pub struct WithdrawalProcessed {
    pub amount: u64,
}
