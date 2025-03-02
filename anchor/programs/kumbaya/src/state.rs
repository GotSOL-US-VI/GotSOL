use anchor_lang::prelude::*;

#[account]
pub struct Global {
    pub house: Pubkey,
    pub global_bump: u8,
}

impl Global {
    pub const LEN: usize = 8 + 32 + 1;
}

#[account]
pub struct Merchant {
    pub owner: Pubkey,
    pub entity_name: String,
    pub total_withdrawn: u64,
    pub total_refunded: u64,
    pub merchant_bump: u8,
}

impl Merchant {
    pub const LEN: usize = 8 + 32 + 24 + 8 + 8 + 1;
}
