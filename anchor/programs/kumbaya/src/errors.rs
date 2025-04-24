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

    #[msg("Employee account is inactive")]
    InactiveEmployee,

    #[msg("Employee has exceeded their daily transaction limit")]
    ExceedsDailyLimit,
    
    #[msg("Invalid employee wallet address format")]
    InvalidEmployeeWallet,
    
    #[msg("Employee name cannot be empty")]
    InvalidEmployeeName,
    
    #[msg("Employee already exists for this merchant")]
    EmployeeAlreadyExists,
    
    #[msg("Employee role is invalid for this operation")]
    InvalidEmployeeRole,
    
    #[msg("Employee cannot be the same as the merchant owner")]
    EmployeeCannotBeOwner,
}
