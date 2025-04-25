use anchor_lang::prelude::*;

#[event]
pub struct RefundProcessed {
    pub original_tx_sig: String,
    pub amount: u64,
    pub recipient: Pubkey,
}

#[event]
pub struct EmployeeCreated {
    pub merchant: Pubkey,
    pub employee: Pubkey,
    pub role: String,
    pub name: String,
}

#[event]
pub struct EmployeeUpdated {
    pub merchant: Pubkey,
    pub employee: Pubkey,
    pub new_role: Option<String>,
    pub is_active: Option<bool>,
}

#[event]
pub struct EmployeeWithdrawal {
    pub merchant: Pubkey,
    pub employee: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct RevenuePayment {
    pub merchant: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
    pub lifetime_paid: u64,
}