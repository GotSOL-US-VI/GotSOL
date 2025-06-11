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

    #[msg("Maximum number of contacts reached!")]
    ContactsLimitReached,

    #[msg("Contact already exists! Remove the existing contact first before re-adding.")]
    ContactAlreadyExists,

    #[msg("Recipient is not in contacts list!")]
    NotInContacts,

    #[msg("Recipient has not cleared its 48 hour hold from time of addition to Contacts list!")]
    ContactNotValidated,

    #[msg("The Contacts account for this Owner exists. You must use different program instructions to send funds, or add your intended recipient to the Contacts list pending a 48-hour activation time, or delete the Contacts list.")]
    ContactsListExists,
}