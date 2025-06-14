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

#[event]
pub struct TaxesPaid {
    pub amount: u64,
    pub merchant: Pubkey,
    pub gov: Pubkey,
    pub mint: Pubkey,
}
