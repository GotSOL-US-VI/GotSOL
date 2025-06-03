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

    #[msg("Compression accounts are required when use_compression is true")]
    MissingCompressionAccounts,
    
    #[msg("Invalid Merkle tree configuration")]
    InvalidMerkleTreeConfig,
    
    #[msg("Merkle proof verification failed")]
    InvalidMerkleProof,
    
    #[msg("Compressed data serialization failed")]
    CompressionSerializationError,
    
    #[msg("Tree authority validation failed")]
    InvalidTreeAuthority,
    
    #[msg("Token must have exactly 6 decimals")]
    InvalidTokenDecimals,
}
