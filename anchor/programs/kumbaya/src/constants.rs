#![allow(unused)]

pub const USDC_DECIMALS: u64 = 1_000_000; // USDC has 6 decimals

pub const HOUSE: &str = "Hth4EBxLWJSoRWj7raCKoniuzcvXt8MUFgGKty3B66ih";

// main net USDC address
pub const USDC_MAINNET_MINT: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// devnet USDC address
pub const USDC_DEVNET_MINT: &str = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

pub const MERCHANT_SHARE: u64 = 985; // 98.5%

pub const HOUSE_SHARE: u64 = 15; // 1.5%

pub const MANAGER3_WITHDRAW_LIMIT: u64 = 10_000 * USDC_DECIMALS; // 10,000 USDC
pub const MANAGER2_WITHDRAW_LIMIT: u64 = 5_000 * USDC_DECIMALS;
pub const MANAGER1_WITHDRAW_LIMIT: u64 = 2_500 * USDC_DECIMALS;
pub const EMPLOYEE3_WITHDRAW_LIMIT: u64 = 1_000 * USDC_DECIMALS;
pub const EMPLOYEE2_REFUND_LIMIT: u64 = 500 * USDC_DECIMALS;
pub const EMPLOYEE1_REFUND_LIMIT: u64 = 100 * USDC_DECIMALS;

