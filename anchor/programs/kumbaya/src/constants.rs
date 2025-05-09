#![allow(unused)]

use anchor_lang::prelude::Pubkey;
use std::str::FromStr;

pub const HOUSE: &str = "Hth4EBxLWJSoRWj7raCKoniuzcvXt8MUFgGKty3B66ih";
pub const AUTH: &str = "Hth4EBxLWJSoRWj7raCKoniuzcvXt8MUFgGKty3B66ih";

pub const OWNER_SHARE: u64 = 9875; // 98.75%
// pub const GOV_SHARE: u64 = 50; // 5.0%
pub const HOUSE_SHARE: u64 = 125; // 1.25%

/* DEVNET STABLECOIN MINT ADDRESSES */
// devnet USDC address
pub const USDC_DEVNET_MINT: &str = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

/* MAIN NET STABLECOIN MINT ADDRESSES */
// USD Circle -- 6 decimals
pub const USDC_MAINNET_MINT: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// Tether -- 6 decimals
pub const USDT_MAINNET_MINT: &str = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

// PayPal USD -- 6 decimals
pub const PYUSD_MAINNET_MINT: &str = "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo";

// Sky USD (previously Dai) -- 6 decimals
pub const USDS_MAINNET_MINT: &str = "USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA";

// Ondo Finance US Dollar Yield -- 6 decimals
pub const USDY_MAINNET_MINT: &str = "A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6";

// Agora Finance USD -- 6 decimals
pub const AUSD_MAINNET_MINT: &str = "AUSD1jCcCyPLybk1YnvPWsHQSrZ46dxwoMniN4N2UEB9";

// MoveUSD -- 6 decimals
pub const MOVEUSD_MAINNET_MINT: &str = "3AdhVEX6k85yNivHVXDEiY3WyP2WgFQTUZCahGaeC2qm";

//First Digital USD -- 6 decimals
pub const FDUSD_MAINNET_MINT: &str = "9zNQRsGLjNKwCUU5Gq5LR8beUCPzQMVMqKAi3SSZh54u";

// Global Dollar -- 6 decimals
pub const USDG_MAINNET_MINT: &str = "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH";

// Coinflow USD -- 9 decimals
pub const CFUSD_MAINNET_MINT: &str = "9Qh5igeYVb9ZC6s6BfNaffycTiNTqv9KhL432LdqyT4Y";

pub const USDC_DECIMALS: u64 = 1_000_000; // USDC has 6 decimals
pub const USDT_DECIMALS: u64 = 1_000_000; // USDT has 6 decimals
pub const PYUSD_DECIMALS: u64 = 1_000_000; // PYUSD has 6 decimals
pub const USDS_DECIMALS: u64 = 1_000_000; // USDS has 6 decimals
pub const USDY_DECIMALS: u64 = 1_000_000; // USDY has 6 decimals
pub const AUSD_DECIMALS: u64 = 1_000_000; // AUSD has 6 decimals
pub const MOVEUSD_DECIMALS: u64 = 1_000_000; // MOVEUSD has 6 decimals
pub const FDUSD_DECIMALS: u64 = 1_000_000; // FDUSD has 6 decimals
pub const USDG_DECIMALS: u64 = 1_000_000; // USDG has 6 decimals
pub const CFUSD_DECIMALS: u64 = 1_000_000_000; // CFUSD has 9 decimals

// List of accepted stablecoin mints (10 total)
pub const ACCEPTED_STABLECOIN_MINTS: [&str; 10] = [
    USDC_MAINNET_MINT,
    USDT_MAINNET_MINT,
    PYUSD_MAINNET_MINT,
    USDS_MAINNET_MINT,
    USDY_MAINNET_MINT,
    AUSD_MAINNET_MINT,
    MOVEUSD_MAINNET_MINT,
    FDUSD_MAINNET_MINT,
    USDG_MAINNET_MINT,
    CFUSD_MAINNET_MINT,
];

// Function to check if a mint is accepted
pub fn is_accepted_stablecoin_mint(mint_pubkey: &Pubkey) -> bool {
    ACCEPTED_STABLECOIN_MINTS.iter().any(|&mint_str| {
        let mint_pubkey_from_str = Pubkey::from_str(mint_str).unwrap();
        *mint_pubkey == mint_pubkey_from_str
    })
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////// LEAVING THIS CODE HERE FOR A LATER UPGRADE, SAVING SPACE ON-CHAIN FOR NOW ///////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// pub const SECONDS_IN_DAY: i64 = 86400; // 86,400 seconds in a day
// pub const MANAGER3_WITHDRAW_LIMIT: u64 = 10_000 * USDC_DECIMALS; // 10,000 USDC
// pub const MANAGER2_WITHDRAW_LIMIT: u64 = 5_000 * USDC_DECIMALS;
// pub const MANAGER1_WITHDRAW_LIMIT: u64 = 2_500 * USDC_DECIMALS;
// pub const EMPLOYEE3_WITHDRAW_LIMIT: u64 = 1_000 * USDC_DECIMALS;
// pub const EMPLOYEE2_REFUND_LIMIT: u64 = 500 * USDC_DECIMALS;
// pub const EMPLOYEE1_REFUND_LIMIT: u64 = 100 * USDC_DECIMALS;

// pub const GOV: &str = "";
// pub const GOV_USDC_ATA: &str = "";
