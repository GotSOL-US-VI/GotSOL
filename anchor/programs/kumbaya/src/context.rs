use anchor_lang::prelude::*;
use std::str::FromStr;

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::constants::*;
use crate::errors::*;
use crate::state::*;
use crate::events::*;


#[derive(Accounts)]
#[instruction(name: String)]
pub struct CreateMerchant<'info> {
    /// Optional fee payer account. If provided, this account will pay for transaction fees.
    /// CHECK: This is an optional account that can pay for transaction fees
    #[account(mut)]
    pub fee_payer: Option<Signer<'info>>,

    #[account(mut, constraint = !name.trim().is_empty() @ CustomError::InvalidMerchantName)]
    pub owner: Signer<'info>,

    #[account(init, payer = fee_payer.as_ref().unwrap_or(&owner), seeds = [b"merchant", name.as_str().as_bytes(), owner.key().as_ref()], space = Merchant::LEN, bump)]
    pub merchant: Box<Account<'info, Merchant>>,

    // main net USDC mint account
    // #[account(constraint = usdc_mint.key() == Pubkey::from_str(USDC_MAINNET_MINT).unwrap())]
    // pub usdc_mint: InterfaceAccount<'info, Mint>,

    // devnet USDC mint account
    #[account(constraint = usdc_mint.key() == Pubkey::from_str(USDC_DEVNET_MINT).unwrap())]
    pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init,
        payer = fee_payer.as_ref().unwrap_or(&owner),
        associated_token::mint = usdc_mint,
        associated_token::authority = merchant
    )]
    pub merchant_usdc_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> CreateMerchant<'info> {
    pub fn init(&mut self, bumps: &CreateMerchantBumps, name: String) -> Result<()> {
        let trimmed_name = name.trim().to_string();
        let mut entity_name = [0u8; 32];
        entity_name[..trimmed_name.len().min(32)].copy_from_slice(trimmed_name.as_bytes());
        
        self.merchant.set_inner(Merchant {
            owner: self.owner.key(),
            entity_name: trimmed_name,
            total_withdrawn: 0,
            total_refunded: 0,
            is_active: true,
            refund_limit: 1000_000000,  // Default 1000 USDC limit
            merchant_bump: bumps.merchant,
        });
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct WithdrawUSDC<'info> {
    #[account(mut)]
    pub fee_payer: Option<Signer<'info>>,

    #[account(mut,
    constraint = amount > 0 @ CustomError::ZeroAmountWithdrawal)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [b"merchant", merchant.entity_name.as_str().as_bytes(), owner.key().as_ref()], 
        bump = merchant.merchant_bump,
        constraint = owner.key() == merchant.owner @ CustomError::NotMerchantOwner
    )]
    pub merchant: Box<Account<'info, Merchant>>,

    #[account(constraint = usdc_mint.key() == Pubkey::from_str(USDC_DEVNET_MINT).unwrap())]
    pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = merchant,
        constraint = merchant_usdc_ata.amount >= amount @ CustomError::InsufficientFunds,
    )]
    pub merchant_usdc_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(init_if_needed, 
        payer = fee_payer.as_ref().unwrap_or(&owner),
        associated_token::mint = usdc_mint,
        associated_token::authority = owner
    )]
    pub owner_usdc_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: This is the HOUSE Squads multi-sig
    #[account(mut, constraint = house.key() == Pubkey::from_str(HOUSE).unwrap())]
    pub house: AccountInfo<'info>,

    #[account(mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = house
    )]
    pub house_usdc_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> WithdrawUSDC<'info> {
    pub fn withdraw(&mut self, amount: u64) -> Result<()> {
        // Check if merchant is inactive and fee payer was provided
        if !self.merchant.is_active && self.fee_payer.is_some() {
            return Err(CustomError::InactiveMerchant.into());
        }
        
        let owner_amount = (amount * OWNER_SHARE) / 1000;
        let house_amount = amount - owner_amount;

        // Optimized seeds creation with proper lifetime handling
        let owner_key = self.owner.key();
        let seeds = &[
            b"merchant".as_ref(),
            self.merchant.entity_name.as_bytes(),
            owner_key.as_ref(),
            &[self.merchant.merchant_bump],
        ];

        // Transfer the owner's share
        anchor_spl::token_interface::transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                anchor_spl::token_interface::TransferChecked {
                    from: self.merchant_usdc_ata.to_account_info(),
                    mint: self.usdc_mint.to_account_info(),
                    to: self.owner_usdc_ata.to_account_info(),
                    authority: self.merchant.to_account_info(),
                },
                &[seeds],
            ),
            owner_amount,
            self.usdc_mint.decimals,
        )?;

        // Transfer house's share
        anchor_spl::token_interface::transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                anchor_spl::token_interface::TransferChecked {
                    from: self.merchant_usdc_ata.to_account_info(),
                    mint: self.usdc_mint.to_account_info(),
                    to: self.house_usdc_ata.to_account_info(),
                    authority: self.merchant.to_account_info(),
                },
                &[seeds],
            ),
            house_amount,
            self.usdc_mint.decimals,
        )?;

        self.merchant.total_withdrawn += amount;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(original_tx_sig: String, amount: u64)]
pub struct RefundPayment<'info> {
    #[account(mut)]
    pub fee_payer: Option<Signer<'info>>,

    #[account(mut, 
        constraint = amount > 0 @ CustomError::ZeroAmountWithdrawal)]
    pub owner: Signer<'info>,

    #[account(mut, 
        seeds = [b"merchant", merchant.entity_name.as_str().as_bytes(), owner.key().as_ref()], 
        bump = merchant.merchant_bump,
        constraint = owner.key() == merchant.owner @ CustomError::NotMerchantOwner,
        constraint = amount <= merchant.refund_limit @ CustomError::ExceedsRefundLimit)]
    pub merchant: Box<Account<'info, Merchant>>,

    #[account(mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = merchant,
        constraint = merchant_usdc_ata.amount >= amount @ CustomError::InsufficientFunds)]
    pub merchant_usdc_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = recipient)]
    pub recipient_usdc_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init,
        payer = fee_payer.as_ref().unwrap_or(&owner),
        seeds = [b"refund", original_tx_sig.as_bytes()],
        space = RefundRecord::LEN,
        bump
    )]
    pub refund_record: Box<Account<'info, RefundRecord>>,

    #[account(constraint = usdc_mint.key() == Pubkey::from_str(USDC_DEVNET_MINT).unwrap())]
    pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,

    /// CHECK: this is the public key of address you are refunding, to derive their USDC ata
    pub recipient: AccountInfo<'info>,
    
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> RefundPayment<'info> {
    pub fn refund(&mut self, original_tx_sig: String, amount: u64, bumps: &RefundPaymentBumps) -> Result<()> {
        // Check if merchant is inactive and fee payer was provided
        if !self.merchant.is_active && self.fee_payer.is_some() {
            return Err(CustomError::InactiveMerchant.into());
        }
        
        // Initialize refund record
        self.refund_record.set_inner(RefundRecord {
            amount,
            original_tx_sig: original_tx_sig.clone(),
            bump: bumps.refund_record
        });

        // Optimized seeds creation with proper lifetime handling
        let owner_key = self.owner.key();
        let seeds = &[
            b"merchant".as_ref(),
            self.merchant.entity_name.as_bytes(),
            owner_key.as_ref(),
            &[self.merchant.merchant_bump],
        ];

        // Transfer the refund amount back to the recipient
        anchor_spl::token_interface::transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                anchor_spl::token_interface::TransferChecked {
                    from: self.merchant_usdc_ata.to_account_info(),
                    mint: self.usdc_mint.to_account_info(),
                    to: self.recipient_usdc_ata.to_account_info(),
                    authority: self.merchant.to_account_info(),
                },
                &[seeds],
            ),
            amount,
            self.usdc_mint.decimals,
        )?;

        // Update merchant state
        self.merchant.total_refunded += amount;

        // Emit event
        emit!(RefundProcessed {
            original_tx_sig,
            amount,
            recipient: self.recipient.key()
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct SetMerchantStatus<'info> {
    /// CHECK: This is the HOUSE Squads multi-sig that must sign
    #[account(mut, constraint = house.key() == Pubkey::from_str(HOUSE).unwrap() @ CustomError::UnauthorizedStatusChange)]
    pub house: Signer<'info>,

    #[account(mut)]
    pub merchant: Box<Account<'info, Merchant>>,

    pub system_program: Program<'info, System>,
}

impl<'info> SetMerchantStatus<'info> {
    pub fn set_status(&mut self, is_active: bool) -> Result<()> {
        self.merchant.is_active = is_active;

        // Emit event for status change
        emit!(MerchantStatusChanged {
            merchant: self.merchant.key(),
            is_active,
            timestamp: Clock::get()?.unix_timestamp
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateRefundLimit<'info> {
    /// Optional fee payer account. If provided, this account will pay for transaction fees.
    /// CHECK: This is an optional account that can pay for transaction fees
    #[account(mut)]
    pub fee_payer: Option<Signer<'info>>,

    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"merchant", merchant.entity_name.as_str().as_bytes(), owner.key().as_ref()],
        bump = merchant.merchant_bump,
        constraint = owner.key() == merchant.owner @ CustomError::NotMerchantOwner
    )]
    pub merchant: Box<Account<'info, Merchant>>,

    pub system_program: Program<'info, System>,
}

impl<'info> UpdateRefundLimit<'info> {
    pub fn update_limit(&mut self, new_limit: u64) -> Result<()> {
        self.merchant.refund_limit = new_limit;
        Ok(())
    }
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////// LEAVING THIS CODE HERE FOR A LATER UPGRADE, SAVING SPACE ON-CHAIN FOR NOW ///////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// #[derive(Accounts)]
// #[instruction(name: String)]
// pub struct CreateEmployee<'info> {
//     #[account(mut)]
//     pub merchant: Box<Account<'info, Merchant>>,
    
//     #[account(
//         init,
//         payer = payer,
//         space = Employee::LEN,
//         seeds = [b"employee", merchant.key().as_ref(), employee_pubkey.key().as_ref()],
//         bump
//     )]
//     pub employee: Box<Account<'info, Employee>>,
    
//     /// CHECK: This is the public key of the employee being added
//     pub employee_pubkey: AccountInfo<'info>,
    
//     #[account(mut)]
//     pub payer: Signer<'info>,
    
//     pub system_program: Program<'info, System>,
// }

// impl<'info> CreateEmployee<'info> {
//     pub fn init(&mut self, role: EmployeeRole, name: String, custom_limits: Option<RoleLimits>) -> Result<()> {
//         // Validate employee name
//         require!(!name.is_empty(), CustomError::InvalidEmployeeName);
//         require!(name.len() <= 32, CustomError::InvalidEmployeeName);
        
//         // Get the bump for the PDA
//         let merchant_key = self.merchant.key();
//         let employee_pubkey = self.employee_pubkey.key();
//         let employee_seeds = &[
//             b"employee",
//             merchant_key.as_ref(),
//             employee_pubkey.as_ref(),
//         ];
//         let (_, bump) = Pubkey::find_program_address(employee_seeds, &crate::ID);
        
//         // Initialize employee account
//         self.employee.merchant = self.merchant.key();
//         self.employee.employee_pubkey = self.employee_pubkey.key();
//         self.employee.role = role;
//         self.employee.name = name;
//         self.employee.is_active = true;
//         self.employee.bump = bump;
        
//         // Get limits - either custom or default based on role
//         let limits = custom_limits.unwrap_or_else(|| RoleLimits::get_default_limits(&role));
        
//         // Initialize daily limits
//         self.employee.daily_limits = DailyLimit {
//             withdraw_limit: limits.withdraw_limit,
//             refund_limit: limits.refund_limit,
//             withdraw_used: 0,
//             refund_used: 0,
//             last_reset: Clock::get()?.unix_timestamp,
//         };
        
//         Ok(())
//     }
// }

// #[derive(Accounts)]
// pub struct UpdateEmployee<'info> {
//     #[account(mut)]
//     pub merchant_owner: Signer<'info>,
    
//     #[account(
//         seeds = [b"merchant", merchant.entity_name.as_str().as_bytes(), merchant_owner.key().as_ref()],
//         bump = merchant.merchant_bump,
//         constraint = merchant.owner == merchant_owner.key()
//     )]
//     pub merchant: Box<Account<'info, Merchant>>,
    
//     #[account(
//         mut,
//         seeds = [
//             b"employee",
//             merchant.key().as_ref(),
//             employee.employee_pubkey.as_ref()
//         ],
//         bump = employee.bump
//     )]
//     pub employee: Box<Account<'info, Employee>>,

//     pub system_program: Program<'info, System>,
// }

// impl<'info> UpdateEmployee<'info> {
//     pub fn update(&mut self, role: Option<EmployeeRole>, is_active: Option<bool>) -> Result<()> {
//         if let Some(new_role) = role {
//             self.employee.role = new_role;
//         }
//         if let Some(active) = is_active {
//             self.employee.is_active = active;
//         }
//         Ok(())
//     }
// }

// #[derive(Accounts)]
// #[instruction(amount: u64)]
// pub struct EmployeeWithdrawUSDC<'info> {
//     #[account(mut,
//     constraint = amount > 0 @ CustomError::UnauthorizedWithdrawal)]
//     pub employee_signer: Signer<'info>,

//     #[account(
//         seeds = [b"merchant", merchant.entity_name.as_str().as_bytes(), merchant.owner.as_ref()], 
//         bump = merchant.merchant_bump,
//         constraint = employee.merchant == merchant.key() @ CustomError::UnauthorizedWithdrawal
//     )]
//     pub merchant: Box<Account<'info, Merchant>>,

//     #[account(
//         seeds = [b"employee", merchant.key().as_ref(), employee_signer.key().as_ref()],
//         bump = employee.bump,
//         constraint = employee_signer.key() == employee.employee_pubkey @ CustomError::UnauthorizedWithdrawal,
//         constraint = employee.is_active @ CustomError::InactiveEmployee
//     )]
//     pub employee: Box<Account<'info, Employee>>,

//     #[account(constraint = usdc_mint.key() == Pubkey::from_str(USDC_DEVNET_MINT).unwrap())]
//     pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,

//     #[account(mut,
//         associated_token::mint = usdc_mint,
//         associated_token::authority = merchant,
//         constraint = merchant_usdc_ata.amount >= amount @ CustomError::InsufficientFunds,
//     )]
//     pub merchant_usdc_ata: Box<InterfaceAccount<'info, TokenAccount>>,

//     // #[account(
//     //     init_if_needed,
//     //     payer = employee_signer,
//     //     seeds = [b"compliance_escrow", merchant.key().as_ref()],
//     //     bump,
//     //     token::mint = usdc_mint,
//     //     token::authority = merchant
//     // )]
//     // pub compliance_escrow: Box<InterfaceAccount<'info, TokenAccount>>,

//     #[account(mut,
//         associated_token::mint = usdc_mint,
//         associated_token::authority = house
//     )]
//     pub house_usdc_ata: Box<InterfaceAccount<'info, TokenAccount>>,

//     /// CHECK: This is the HOUSE Squads multi-sig
//     #[account(mut, constraint = house.key() == Pubkey::from_str(HOUSE).unwrap())]
//     pub house: AccountInfo<'info>,

//     /// CHECK: This is the merchant owner
//     #[account(mut, constraint = owner.key() == merchant.owner @ CustomError::UnauthorizedWithdrawal)]
//     pub owner: AccountInfo<'info>,

//     #[account(init_if_needed, payer = employee_signer,
//         associated_token::mint = usdc_mint,
//         associated_token::authority = owner
//     )]
//     pub owner_usdc_ata: Box<InterfaceAccount<'info, TokenAccount>>,

//     pub associated_token_program: Program<'info, AssociatedToken>,
//     pub token_program: Interface<'info, TokenInterface>,
//     pub system_program: Program<'info, System>,
// }

// impl<'info> EmployeeWithdrawUSDC<'info> {
//     pub fn withdraw(&mut self, amount: u64) -> Result<()> {
//         let owner_amount = (amount * OWNER_SHARE) / 1000;
//         let house_amount = amount - owner_amount;

//         // Update employee daily limits
//         if self.employee.role != EmployeeRole::Owner {
//             let now = Clock::get()?.unix_timestamp;
            
//             if now - self.employee.daily_limits.last_reset >= SECONDS_IN_DAY {
//                 self.employee.daily_limits.withdraw_used = amount;
//                 self.employee.daily_limits.last_reset = now;
//             } else {
//                 self.employee.daily_limits.withdraw_used += amount;
//             }
//         }

//         // Transfer tokens using merchant authority
//         let seeds = &[
//             b"merchant".as_ref(),
//             self.merchant.entity_name.as_bytes(),
//             self.merchant.owner.as_ref(),
//             &[self.merchant.merchant_bump],
//         ];

//         // Transfer owner's share
//         anchor_spl::token_interface::transfer_checked(
//             CpiContext::new_with_signer(
//                 self.token_program.to_account_info(),
//                 anchor_spl::token_interface::TransferChecked {
//                     from: self.merchant_usdc_ata.to_account_info(),
//                     mint: self.usdc_mint.to_account_info(),
//                     to: self.owner_usdc_ata.to_account_info(),
//                     authority: self.merchant.to_account_info(),
//                 },
//                 &[seeds],
//             ),
//             owner_amount,
//             self.usdc_mint.decimals,
//         )?;

//         // Transfer house's share
//         anchor_spl::token_interface::transfer_checked(
//             CpiContext::new_with_signer(
//                 self.token_program.to_account_info(),
//                 anchor_spl::token_interface::TransferChecked {
//                     from: self.merchant_usdc_ata.to_account_info(),
//                     mint: self.usdc_mint.to_account_info(),
//                     to: self.house_usdc_ata.to_account_info(),
//                     authority: self.merchant.to_account_info(),
//                 },
//                 &[seeds],
//             ),
//             house_amount,
//             self.usdc_mint.decimals,
//         )?;

//         require!(self.employee.can_withdraw(amount, Clock::get()?), CustomError::InvalidEmployeeRole);
//         require!(self.employee.daily_limits.check_limit(amount, true, Clock::get()?), CustomError::ExceedsDailyLimit);

//         Ok(())
//     }
// }

// #[derive(Accounts)]
// pub struct MakeRevenuePayment<'info> {
//     #[account(mut)]
//     pub owner: Signer<'info>,

//     #[account(mut, 
//         seeds = [b"merchant", merchant.entity_name.as_str().as_bytes(), owner.key().as_ref()], 
//         bump = merchant.merchant_bump,
//         constraint = owner.key() == merchant.owner)]
//     pub merchant: Box<Account<'info, Merchant>>,

//     #[account(
//         mut,
//         seeds = [b"compliance_escrow", merchant.key().as_ref()],
//         bump,
//         token::mint = usdc_mint,
//         token::authority = merchant,
//         constraint = compliance_escrow.amount > 0 @ CustomError::InsufficientFunds
//     )]
//     pub compliance_escrow: Box<InterfaceAccount<'info, TokenAccount>>,

//     #[account(init_if_needed, payer = owner, seeds = [b"compliance", merchant.key().as_ref()], space = Compliance::LEN, bump)]
//     pub compliance: Box<Account<'info, Compliance>>,

//     // main net USDC mint account
//     // #[account(constraint = usdc_mint.key() == Pubkey::from_str(USDC_MAINNET_MINT).unwrap())]
//     // pub usdc_mint: InterfaceAccount<'info, Mint>,

//     // devnet USDC mint account
//     #[account(constraint = usdc_mint.key() == Pubkey::from_str(USDC_DEVNET_MINT).unwrap())]
//     pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,

//     /// CHECK: This is GOV's pubkey
//     #[account(mut, constraint = gov_account.key() == Pubkey::from_str(GOV).unwrap())]
//     pub gov_account: AccountInfo<'info>,

//     #[account(init_if_needed, payer = owner,
//         associated_token::mint = usdc_mint,
//         associated_token::authority = gov_account
//     )]
//     pub gov_usdc_ata: Box<InterfaceAccount<'info, TokenAccount>>, 

//     pub associated_token_program: Program<'info, AssociatedToken>,
//     pub token_program: Interface<'info, TokenInterface>,
//     pub system_program: Program<'info, System>,
// }

// impl<'info> MakeRevenuePayment<'info> {
//     pub fn make_revenue_payment(&mut self, bumps: &MakeRevenuePaymentBumps) -> Result<()> {
//         // Check if the compliance account exists by checking if the bump value is the default value (0)
//         if self.compliance.bump == 0 {
//             // Initialize merchant's compliance account if it doesn't exist yet
//             self.compliance.set_inner(Compliance {
//                 lifetime_paid: 0,
//                 last_payment: 0,
//                 bump: bumps.compliance
//             });
//         }

//         let amount = self.compliance_escrow.amount;

//         // Optimized seeds creation with proper lifetime handling
//         let owner_key = self.owner.key();
//         let seeds = &[
//             b"merchant".as_ref(),
//             self.merchant.entity_name.as_bytes(),
//             owner_key.as_ref(),
//             &[self.merchant.merchant_bump],
//         ];

//         // Transfer the merchant's compliance_escrow balance to GOV's usdc ata
//         anchor_spl::token_interface::transfer_checked(
//             CpiContext::new_with_signer(
//                 self.token_program.to_account_info(),
//                 anchor_spl::token_interface::TransferChecked {
//                     from: self.compliance_escrow.to_account_info(),
//                     mint: self.usdc_mint.to_account_info(),
//                     to: self.gov_usdc_ata.to_account_info(),
//                     authority: self.merchant.to_account_info(),
//                 },
//                 &[seeds],
//             ),
//             amount,
//             self.usdc_mint.decimals,
//         )?;

//         // Update the merchant's compliance account's last_payment and lifetime_paid state
//         self.compliance.lifetime_paid += amount;
//         self.compliance.last_payment = Clock::get()?.unix_timestamp;

//         Ok(())
//     }
// }
