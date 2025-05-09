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
