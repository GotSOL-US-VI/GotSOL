use anchor_lang::prelude::*;

// Constants for maximum string lengths
pub const MAX_ENTITY_NAME_LEN: usize = 32;


#[account]
pub struct Merchant {
    pub owner: Pubkey,
    pub entity_name: String,
    pub fee_eligible: bool,
    pub merchant_bump: u8,
    pub vault_bump: u8,
    pub compliance_bump: u8
}

impl Merchant {
    pub const LEN: usize = 8 + 32 + (4 + MAX_ENTITY_NAME_LEN) + 1 + 1 + 1 + 1;
}