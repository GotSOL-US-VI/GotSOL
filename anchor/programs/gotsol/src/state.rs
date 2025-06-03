use anchor_lang::prelude::*;
// use crate::constants::*;

#[account]
pub struct Merchant {
    pub owner: Pubkey,
    pub entity_name: String,
    pub total_withdrawn: u64,
    pub total_refunded: u64,
    pub fee_eligible: bool,  // Boolean for fee eligibility as mentioned by user
    pub merchant_bump: u8,
}

impl Merchant {
    pub const LEN: usize = 8 + 32 + 24 + 8 + 8 + 1 + 1; // Added 1 byte for fee_eligible
}

#[account]
pub struct RefundRecord {
    pub amount: u64,
    pub original_tx_sig: String,
    pub bump: u8,
}

impl RefundRecord {
    pub const LEN: usize = 8 + 8 + 32 + 1;
}
// New struct for compressed merchant state
#[account]
pub struct CompressedMerchantState {
    pub merkle_tree: Pubkey,        // Reference to the Merkle tree
    pub leaf_index: u32,            // Index in the tree
    pub is_compressed: bool,        // Flag to indicate compression
}

impl CompressedMerchantState {
    pub const LEN: usize = 8 + 32 + 4 + 1;
}

// Tree authority PDA state
#[account]
pub struct TreeAuthority {
    pub bump: u8,
}

// Data structure for compressed merchant data (stored in Merkle tree)
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CompressedMerchantData {
    pub owner: Pubkey,
    pub entity_name: String,
    pub total_withdrawn: u64,
    pub total_refunded: u64,
    pub fee_eligible: bool,
}

