use anchor_lang::prelude::*;

#[error_code]
pub enum CustomError {
    #[msg("Error creating merchant.")]
    CreateMerchantError,

    #[msg("Insufficient funds for withdrawal; input amount is greater than available balance.")]
    InsufficientFunds,

    #[msg("Invalid split calculation.")]
    InvalidSplitCalculation,

    #[msg("Invalid withdrawal amount; withdraw amount must be greater than 0")]
    InvalidAmount,

    #[msg("Unauthorized withdrawal attempt; only the Merchant's Owner can withdraw.")]
    UnauthorizedWithdrawal,

    #[msg("Invalid merchant name: cannot be empty")]
    InvalidMerchantName,
}
