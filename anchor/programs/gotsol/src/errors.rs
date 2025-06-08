use anchor_lang::prelude::*;

#[error_code]
pub enum CustomError {
    #[msg("Insufficient funds for withdrawal; input amount is greater than available balance!")]
    InsufficientFunds,

    #[msg("Refund amount must be greater than 0!")]
    ZeroAmountRefund,

    #[msg("Invalid merchant name: cannot be empty!")]
    InvalidMerchantName,

    #[msg("Only the AUTH can change a Merchant fee eligibility status!")]
    UnauthorizedStatusChange,

    #[msg("Arithmetic operation resulted in overflow or underflow!")]
    ArithmeticOverflow,

    #[msg("Withdrawal amount is below minimum amount!")]
    BelowMinimumWithdrawal,

    #[msg("Invalid withdrawal amount: calculated amount is zero!")]
    InvalidWithdrawalAmount,

    #[msg("Insufficient balance: withdrawal would leave vault below rent-exempt threshold!")]
    InsufficientRentBalance,
}