use anchor_lang::prelude::*;

#[error_code]
pub enum CustomError {
    #[msg("Insufficient funds for withdrawal; input amount is greater than available balance!")]
    InsufficientFunds,

    #[msg("Only the Merchant's Owner can call this instruction!")]
    NotMerchantOwner,

    #[msg("Withdrawal amount must be greater than 0!")]
    ZeroAmountWithdrawal,

    #[msg("Invalid merchant name: cannot be empty!")]
    InvalidMerchantName,

    #[msg("This merchant account is currently not eligible for our fee-paying service. You can still operate your Merchant accounts, but you will have to pay your own fees.")]
    FeeIneligibleMerchant,

    #[msg("Only the AUTH can change a Merchant fee eligibility status!")]
    UnauthorizedStatusChange,

    #[msg("Invalid transaction signature format!")]
    InvalidTransactionSignature,

    #[msg("Refund amount exceeds maximum allowed per transaction!")]
    ExcessiveRefundAmount,

    #[msg("Arithmetic operation resulted in overflow!")]
    ArithmeticOverflow,
}