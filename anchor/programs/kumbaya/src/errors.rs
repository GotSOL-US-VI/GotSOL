use anchor_lang::prelude::*;

#[error_code]
pub enum CustomError {
    #[msg("Insufficient funds for withdrawal; input amount is greater than available balance.")]
    InsufficientFunds,

    #[msg("Unauthorized withdrawal attempt; only the Merchant's Owner can withdraw, or amount is 0.")]
    UnauthorizedWithdrawal,

    #[msg("Invalid merchant name: cannot be empty")]
    InvalidMerchantName,

    #[msg("Unauthorized refund; caller is not the Merchant's Owner, or amount is 0.")]
    UnauthorizedRefund,
}
