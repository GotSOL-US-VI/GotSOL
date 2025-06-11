use anchor_lang::prelude::*;

#[event]
pub struct SplRefundProcessed {
    pub original_tx_sig: String,
    pub amount: u64,
    pub mint: Pubkey,
    pub recipient: Pubkey,
}

#[event]
pub struct SolRefundProcessed {
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
pub struct WithdrawSplProcessed {
    pub amount: u64,
    pub owner_amount: u64,
    pub house_amount: u64,
    pub mint: Pubkey,
}

#[event]
pub struct WithdrawSolProcessed {
    pub amount: u64,
    pub owner_amount: u64,
    pub house_amount: u64,
}
