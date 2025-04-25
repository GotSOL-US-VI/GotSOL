use anchor_lang::prelude::*;
use crate::constants::*;

#[account]
pub struct Merchant {
    pub owner: Pubkey,
    pub entity_name: String,
    pub total_withdrawn: u64,
    pub total_refunded: u64,
    pub merchant_bump: u8,
}

impl Merchant {
    pub const LEN: usize = 8 + 32 + 24 + 8 + 8 + 1;
}

#[account]
pub struct RefundRecord {
    pub amount: u64,
    pub original_tx_sig: String,
    pub bump: u8,
}

impl RefundRecord {
    pub const LEN: usize = 8 + 8 + 32 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug, Copy)]
pub enum EmployeeRole {
    Owner,      // Full access (implicit)
    Manager3,   // Highest manager tier - can manage other employees, withdraw/refund up to high limits
    Manager2,   // Mid manager tier - can manage regular employees, moderate withdraw/refund limits
    Manager1,   // Junior manager - basic employee management, lower limits
    Employee3,  // Senior employee - can process larger refunds/withdrawals
    Employee2,  // Regular employee - standard operations with moderate limits
    Employee1,  // Junior employee - basic operations with strict limits
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct DailyLimit {
    pub withdraw_limit: u64,    // Daily USDC withdrawal limit
    pub refund_limit: u64,      // Daily USDC refund limit
    pub withdraw_used: u64,     // Amount withdrawn today
    pub refund_used: u64,       // Amount refunded today
    pub last_reset: i64,        // Timestamp of last limit reset
}

impl DailyLimit {
    pub const LEN: usize = 8 + 8 + 8 + 8 + 8;

    pub fn check_limit(&self, amount: u64, is_withdraw: bool, clock: Clock) -> bool {
        let now = clock.unix_timestamp;
        
        // Reset limits if it's a new day
        if now - self.last_reset >= SECONDS_IN_DAY {
            return true;
        }

        if is_withdraw {
            self.withdraw_used + amount <= self.withdraw_limit
        } else {
            self.refund_used + amount <= self.refund_limit
        }
    }
}

#[account]
pub struct Employee {
    pub merchant: Pubkey,           // Parent merchant account
    pub employee_pubkey: Pubkey,    // Employee's wallet address
    pub role: EmployeeRole,         // Employee's role/tier
    pub name: String,               // Employee's name (max 32 chars)
    pub daily_limits: DailyLimit,   // Daily transaction limits
    pub is_active: bool,            // Whether this account is active
    pub bump: u8,
}

impl Employee {
    pub const LEN: usize = 8 +     // discriminator
        32 +    // merchant pubkey
        32 +    // employee pubkey
        1 +     // role enum
        36 +    // name string (max 32 chars + 4 bytes for length)
        DailyLimit::LEN + // daily limits struct
        1 +     // is_active
        1;      // bump

    pub fn can_withdraw(&self, amount: u64, clock: Clock) -> bool {
        match self.role {
            EmployeeRole::Owner => true,
            EmployeeRole::Manager3 |
            EmployeeRole::Manager2 |
            EmployeeRole::Manager1 |
            EmployeeRole::Employee3 => self.daily_limits.check_limit(amount, true, clock),
            _ => false,
        }
    }

    pub fn can_refund(&self, amount: u64, clock: Clock) -> bool {
        match self.role {
            EmployeeRole::Owner => true,
            EmployeeRole::Manager3 |
            EmployeeRole::Manager2 |
            EmployeeRole::Manager1 |
            EmployeeRole::Employee3 |
            EmployeeRole::Employee2 => self.daily_limits.check_limit(amount, false, clock),
            _ => false,
        }
    }
}


#[account]
pub struct Compliance {
    pub lifetime_paid: u64,
    pub last_payment: i64,
    pub bump: u8
}

impl Compliance {
    pub const LEN: usize = 8 + 8 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct RoleLimits {
    pub withdraw_limit: u64,
    pub refund_limit: u64,
}

impl RoleLimits {
    pub fn get_default_limits(role: &EmployeeRole) -> Self {
        match role {
            EmployeeRole::Manager3 => RoleLimits {
                withdraw_limit: 10000_000000, // 10,000 USDC
                refund_limit: 5000_000000,   // 5,000 USDC
            },
            EmployeeRole::Manager2 => RoleLimits {
                withdraw_limit: 5000_000000,  // 5,000 USDC
                refund_limit: 2500_000000,   // 2,500 USDC
            },
            EmployeeRole::Manager1 => RoleLimits {
                withdraw_limit: 2500_000000,  // 2,500 USDC
                refund_limit: 1000_000000,   // 1,000 USDC
            },
            EmployeeRole::Employee3 => RoleLimits {
                withdraw_limit: 1000_000000,  // 1,000 USDC
                refund_limit: 500_000000,    // 500 USDC
            },
            EmployeeRole::Employee2 => RoleLimits {
                withdraw_limit: 500_000000,   // 500 USDC
                refund_limit: 250_000000,    // 250 USDC
            },
            EmployeeRole::Employee1 => RoleLimits {
                withdraw_limit: 250_000000,   // 250 USDC
                refund_limit: 100_000000,    // 100 USDC
            },
            EmployeeRole::Owner => RoleLimits {
                withdraw_limit: u64::MAX,     // No limit for owner
                refund_limit: u64::MAX,      // No limit for owner
            },
        }
    }
}

