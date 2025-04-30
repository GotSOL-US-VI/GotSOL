use anchor_lang::prelude::*;

#[error_code]
pub enum CustomError {
    #[msg("Insufficient funds for withdrawal; input amount is greater than available balance.")]
    InsufficientFunds,

    #[msg("Only the Merchant's Owner can call this instruction.")]
    NotMerchantOwner,

    #[msg("Withdrawal amount must be greater than 0")]
    ZeroAmountWithdrawal,

    #[msg("Invalid merchant name: cannot be empty")]
    InvalidMerchantName,

    #[msg("This merchant account is currently inactive. Do not pass the fee payer account in your transaction, and the Owner will pay for the transaction instead.")]
    InactiveMerchant,

    #[msg("Refund amount exceeds the merchant's configured limit")]
    ExceedsRefundLimit,

    #[msg("Only the HOUSE account can change merchant status")]
    UnauthorizedStatusChange,
    
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //////////////////// LEAVING THIS CODE HERE FOR A LATER UPGRADE, SAVING SPACE ON-CHAIN FOR NOW ///////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // #[msg("Employee account is inactive")]
    // InactiveEmployee,

    // #[msg("Employee has exceeded their daily transaction limit")]
    // ExceedsDailyLimit,

    // #[msg("Invalid employee wallet address format")]
    // InvalidEmployeeWallet,

    // #[msg("Employee name cannot be empty")]
    // InvalidEmployeeName,

    // #[msg("Employee already exists for this merchant")]
    // EmployeeAlreadyExists,

    // #[msg("Employee role is invalid for this operation")]
    // InvalidEmployeeRole,

    // #[msg("Employee cannot be the same as the merchant owner")]
    // EmployeeCannotBeOwner,
}
