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
pub struct InitGlobal<'info> {
    // only the HOUSE can pay for this
    #[account(mut, constraint = house.key() == Pubkey::from_str(HOUSE).unwrap())]
    pub house: Signer<'info>,

    #[account(init, payer = house, seeds = [b"global"], space = Global::LEN, bump)]
    pub global: Account<'info, Global>,

    // main net USDC mint account
    // #[account(constraint = usdc_mint.key() == Pubkey::from_str(USDC_MAINNET_MINT).unwrap())]
    // pub usdc_mint: InterfaceAccount<'info, Mint>,

    // devnet USDC mint account
    #[account(constraint = usdc_mint.key() == Pubkey::from_str(USDC_DEVNET_MINT).unwrap())]
    pub usdc_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = house,
        associated_token::mint = usdc_mint,
        associated_token::authority = house
    )]
    pub house_usdc_ata: InterfaceAccount<'info, TokenAccount>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitGlobal<'info> {
    pub fn init(&mut self, bumps: &InitGlobalBumps) -> Result<()> {
        self.global.set_inner(Global {
            house: self.house.key(),
            global_bump: bumps.global,
        });
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct CreateMerchant<'info> {
    #[account(mut, constraint = !name.trim().is_empty() @ CustomError::InvalidMerchantName)]
    pub owner: Signer<'info>,

    #[account(init, payer = owner, seeds = [b"merchant", name.as_str().as_bytes(), owner.key().as_ref()], space = Merchant::LEN, bump)]
    pub merchant: Account<'info, Merchant>,

    // main net USDC mint account
    // #[account(constraint = usdc_mint.key() == Pubkey::from_str(USDC_MAINNET_MINT).unwrap())]
    // pub usdc_mint: InterfaceAccount<'info, Mint>,

    // devnet USDC mint account
    #[account(constraint = usdc_mint.key() == Pubkey::from_str(USDC_DEVNET_MINT).unwrap())]
    pub usdc_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = owner,
        associated_token::mint = usdc_mint,
        associated_token::authority = merchant
    )]
    pub merchant_usdc_ata: InterfaceAccount<'info, TokenAccount>,

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
            merchant_bump: bumps.merchant,
        });
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct WithdrawUSDC<'info> {
    #[account(mut,
    constraint = owner.key() == merchant.owner && amount > 0 @ CustomError::UnauthorizedWithdrawal)]
    pub owner: Signer<'info>,

    #[account(seeds = [b"merchant", merchant.entity_name.as_str().as_bytes(), owner.key().as_ref()], bump = merchant.merchant_bump)]
    pub merchant: Box<Account<'info, Merchant>>,

    #[account(constraint = usdc_mint.key() == Pubkey::from_str(USDC_DEVNET_MINT).unwrap())]
    pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = merchant,
        constraint = merchant_usdc_ata.amount >= amount @ CustomError::InsufficientFunds,
    )]
    pub merchant_usdc_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = owner,
        seeds = [b"compliance_escrow", merchant.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = merchant
    )]
    pub compliance_escrow: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(init_if_needed, payer = owner,
        associated_token::mint = usdc_mint,
        associated_token::authority = owner
    )]
    pub owner_usdc_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> WithdrawUSDC<'info> {
    pub fn withdraw(&mut self, amount: u64) -> Result<()> {
        let owner_amount = (amount * OWNER_SHARE) / 1000;
        let the_man_amount = amount - owner_amount;

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

        // Transfer remaining amount to compliance escrow
        anchor_spl::token_interface::transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                anchor_spl::token_interface::TransferChecked {
                    from: self.merchant_usdc_ata.to_account_info(),
                    mint: self.usdc_mint.to_account_info(),
                    to: self.compliance_escrow.to_account_info(),
                    authority: self.merchant.to_account_info(),
                },
                &[seeds],
            ),
            the_man_amount,
            self.usdc_mint.decimals,
        )?;

        self.merchant.total_withdrawn += amount;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(original_tx_sig: String, amount: u64)]
pub struct RefundPayment<'info> {
    #[account(mut, 
        constraint = owner.key() == merchant.owner @ CustomError::UnauthorizedRefund)]
    pub owner: Signer<'info>,

    #[account(mut, 
        seeds = [b"merchant", merchant.entity_name.as_str().as_bytes(), owner.key().as_ref()], 
        bump = merchant.merchant_bump)]
    pub merchant: Account<'info, Merchant>,

    #[account(mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = merchant)]
    pub merchant_usdc_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = recipient)]
    pub recipient_usdc_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = owner,
        seeds = [b"refund", original_tx_sig.as_bytes()],
        space = RefundRecord::LEN,
        bump
    )]
    pub refund_record: Account<'info, RefundRecord>,

    #[account(constraint = usdc_mint.key() == Pubkey::from_str(USDC_DEVNET_MINT).unwrap())]
    pub usdc_mint: InterfaceAccount<'info, Mint>,

    /// CHECK: this is the public key of address you are refunding, to derive their USDC ata
    pub recipient: AccountInfo<'info>,
    
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> RefundPayment<'info> {
    pub fn refund(&mut self, original_tx_sig: String, amount: u64, bumps: &RefundPaymentBumps) -> Result<()> {
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
pub struct PayTheMan<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut, 
        seeds = [b"merchant", merchant.entity_name.as_str().as_bytes(), owner.key().as_ref()], 
        bump = merchant.merchant_bump)]
    pub merchant: Account<'info, Merchant>,

    #[account(
        mut,
        seeds = [b"compliance_escrow", merchant.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = merchant
    )]
    pub compliance_escrow: InterfaceAccount<'info, TokenAccount>,

    #[account(init_if_needed, payer = owner, seeds = [b"compliance", merchant.key().as_ref()], space = Compliance::LEN, bump)]
    pub compliance: Account<'info, Compliance>,

    // main net USDC mint account
    // #[account(constraint = usdc_mint.key() == Pubkey::from_str(USDC_MAINNET_MINT).unwrap())]
    // pub usdc_mint: InterfaceAccount<'info, Mint>,

    // devnet USDC mint account
    #[account(constraint = usdc_mint.key() == Pubkey::from_str(USDC_DEVNET_MINT).unwrap())]
    pub usdc_mint: InterfaceAccount<'info, Mint>,

    /// CHECK: This is THE_MAN's pubkey
    #[account(mut, constraint = the_man.key() == Pubkey::from_str(THE_MAN).unwrap())]
    pub the_man: AccountInfo<'info>,

    #[account(init_if_needed, payer = owner,
        associated_token::mint = usdc_mint,
        associated_token::authority = the_man
    )]
    pub the_man_usdc_ata: InterfaceAccount<'info, TokenAccount>, 

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> PayTheMan<'info> {
    pub fn paytheman(&mut self, bumps: &PayTheManBumps) -> Result<()> {

    // Check if the compliance account exists by checking if the bump value is the default value (0)
    if self.compliance.bump == 0 {
        // Initialize merchant's compliance account if it doesn't exist yet
        self.compliance.set_inner(Compliance {
            lifetime_paid: 0,
            last_payment: 0,
            bump: bumps.compliance
        });
    }

    let amount = self.compliance_escrow.amount;

        // Optimized seeds creation with proper lifetime handling
        let owner_key = self.owner.key();
        let seeds = &[
            b"merchant".as_ref(),
            self.merchant.entity_name.as_bytes(),
            owner_key.as_ref(),
            &[self.merchant.merchant_bump],
        ];

    // Transfer the merchant's compliance_escrow balance to THE_MAN's usdc ata
    anchor_spl::token_interface::transfer_checked(
        CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            anchor_spl::token_interface::TransferChecked {
                from: self.compliance_escrow.to_account_info(),
                mint: self.usdc_mint.to_account_info(),
                to: self.the_man_usdc_ata.to_account_info(),
                authority: self.merchant.to_account_info(),
            },
            &[seeds],
        ),
        amount,
        self.usdc_mint.decimals,
    )?;

    // Update the merchant's compliance account's last_payment and lifetime_paid state
    self.compliance.lifetime_paid += amount;
    self.compliance.last_payment = Clock::get()?.unix_timestamp;

    Ok(())
}
}


#[derive(Accounts)]
#[instruction(name: String)]
pub struct CreateEmployee<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    
    #[account(seeds = [b"merchant", merchant.entity_name.as_str().as_bytes(), owner.key().as_ref()], bump = merchant.merchant_bump)]
    pub merchant: Account<'info, Merchant>,
    
    #[account(
        init,
        payer = owner,
        space = Employee::LEN,
        seeds = [
            b"employee",
            merchant.key().as_ref(),
            employee_pubkey.key().as_ref()
        ],
        bump
    )]
    pub employee: Account<'info, Employee>,
    
    /// CHECK: The public key of the employee being added
    pub employee_pubkey: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

impl<'info> CreateEmployee<'info> {
    pub fn init(&mut self, bumps: &CreateEmployeeBumps, name: String, role: EmployeeRole) -> Result<()> {
        let daily_limits = match role {
            EmployeeRole::Manager3 => DailyLimit {
                withdraw_limit: MANAGER3_WITHDRAW_LIMIT,
                refund_limit: MANAGER3_WITHDRAW_LIMIT,
                withdraw_used: 0,
                refund_used: 0,
                last_reset: Clock::get()?.unix_timestamp,
            },
            EmployeeRole::Manager2 => DailyLimit {
                withdraw_limit: MANAGER2_WITHDRAW_LIMIT,
                refund_limit: MANAGER2_WITHDRAW_LIMIT,
                withdraw_used: 0,
                refund_used: 0,
                last_reset: Clock::get()?.unix_timestamp,
            },
            EmployeeRole::Manager1 => DailyLimit {
                withdraw_limit: MANAGER1_WITHDRAW_LIMIT,
                refund_limit: MANAGER1_WITHDRAW_LIMIT,
                withdraw_used: 0,
                refund_used: 0,
                last_reset: Clock::get()?.unix_timestamp,
            },
            EmployeeRole::Employee3 => DailyLimit {
                withdraw_limit: EMPLOYEE3_WITHDRAW_LIMIT,
                refund_limit: EMPLOYEE3_WITHDRAW_LIMIT,
                withdraw_used: 0,
                refund_used: 0,
                last_reset: Clock::get()?.unix_timestamp,
            },
            EmployeeRole::Employee2 => DailyLimit {
                withdraw_limit: 0,
                refund_limit: EMPLOYEE2_REFUND_LIMIT,
                withdraw_used: 0,
                refund_used: 0,
                last_reset: Clock::get()?.unix_timestamp,
            },
            EmployeeRole::Employee1 => DailyLimit {
                withdraw_limit: 0,
                refund_limit: EMPLOYEE1_REFUND_LIMIT,
                withdraw_used: 0,
                refund_used: 0,
                last_reset: Clock::get()?.unix_timestamp,
            },
            _ => return Err(error!(CustomError::UnauthorizedWithdrawal)),
        };

        self.employee.set_inner(Employee {
            merchant: self.merchant.key(),
            employee_pubkey: self.employee_pubkey.key(),
            role,
            name: name.clone(),
            daily_limits,
            is_active: true,
            bump: bumps.employee,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateEmployee<'info> {
    #[account(mut)]
    pub merchant_owner: Signer<'info>,
    
    #[account(
        seeds = [b"merchant", merchant.entity_name.as_str().as_bytes(), merchant_owner.key().as_ref()],
        bump = merchant.merchant_bump,
        constraint = merchant.owner == merchant_owner.key()
    )]
    pub merchant: Account<'info, Merchant>,
    
    #[account(
        mut,
        seeds = [
            b"employee",
            merchant.key().as_ref(),
            employee.employee_pubkey.as_ref()
        ],
        bump = employee.bump
    )]
    pub employee: Account<'info, Employee>,

    pub system_program: Program<'info, System>,
}

impl<'info> UpdateEmployee<'info> {
    pub fn update(&mut self, role: Option<EmployeeRole>, is_active: Option<bool>) -> Result<()> {
        if let Some(new_role) = role {
            self.employee.role = new_role;
        }
        if let Some(active) = is_active {
            self.employee.is_active = active;
        }
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct EmployeeWithdrawUSDC<'info> {
    #[account(mut)]
    pub employee_signer: Signer<'info>,
    
    #[account(
        seeds = [b"merchant", merchant.entity_name.as_str().as_bytes(), merchant.owner.as_ref()],
        bump = merchant.merchant_bump
    )]
    pub merchant: Account<'info, Merchant>,
    
    #[account(
        seeds = [
            b"employee",
            merchant.key().as_ref(),
            employee_signer.key().as_ref()
        ],
        bump = employee.bump,
        constraint = employee.is_active @ CustomError::InactiveEmployee,
        constraint = employee.can_withdraw(amount, Clock::get()?) @ CustomError::ExceedsDailyLimit
    )]
    pub employee: Account<'info, Employee>,
    
    #[account(constraint = usdc_mint.key() == Pubkey::from_str(USDC_DEVNET_MINT).unwrap())]
    pub usdc_mint: InterfaceAccount<'info, Mint>,

    #[account(mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = merchant,
        constraint = merchant_usdc_ata.amount >= amount @ CustomError::InsufficientFunds,
    )]
    pub merchant_usdc_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = house
    )]
    pub house_usdc_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: This is the HOUSE Squads multi-sig
    #[account(mut, constraint = house.key() == Pubkey::from_str(HOUSE).unwrap())]
    pub house: AccountInfo<'info>,

    #[account(init_if_needed, payer = employee_signer,
        associated_token::mint = usdc_mint,
        associated_token::authority = employee_signer
    )]
    pub employee_usdc_ata: InterfaceAccount<'info, TokenAccount>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> EmployeeWithdrawUSDC<'info> {
    pub fn withdraw(&mut self, _amount: u64) -> Result<()> {
        // let owner_amount = (amount * OWNER_SHARE) / 1000;
        // let house_amount = amount - owner_amount;

        // // Update employee daily limits
        // if self.employee.role != EmployeeRole::Owner {
        //     let now = Clock::get()?.unix_timestamp;
        //     let day_seconds = 24 * 60 * 60;
            
        //     if now - self.employee.daily_limits.last_reset >= day_seconds {
        //         self.employee.daily_limits.withdraw_used = amount;
        //         self.employee.daily_limits.last_reset = now;
        //     } else {
        //         self.employee.daily_limits.withdraw_used += amount;
        //     }
        // }

        // // Transfer tokens using merchant authority
        // let seeds = &[
        //     b"merchant".as_ref(),
        //     self.merchant.entity_name.as_bytes(),
        //     self.merchant.owner.as_ref(),
        //     &[self.merchant.merchant_bump],
        // ];

        // // Transfer employee's share
        // anchor_spl::token_interface::transfer_checked(
        //     CpiContext::new_with_signer(
        //         self.token_program.to_account_info(),
        //         anchor_spl::token_interface::TransferChecked {
        //             from: self.merchant_usdc_ata.to_account_info(),
        //             mint: self.usdc_mint.to_account_info(),
        //             to: self.employee_usdc_ata.to_account_info(),
        //             authority: self.merchant.to_account_info(),
        //         },
        //         &[seeds],
        //     ),
        //     owner_amount,
        //     self.usdc_mint.decimals,
        // )?;

        // // Transfer house's share
        // anchor_spl::token_interface::transfer_checked(
        //     CpiContext::new_with_signer(
        //         self.token_program.to_account_info(),
        //         anchor_spl::token_interface::TransferChecked {
        //             from: self.merchant_usdc_ata.to_account_info(),
        //             mint: self.usdc_mint.to_account_info(),
        //             to: self.house_usdc_ata.to_account_info(),
        //             authority: self.merchant.to_account_info(),
        //         },
        //         &[seeds],
        //     ),
        //     house_amount,
        //     self.usdc_mint.decimals,
        // )?;

        Ok(())
    }
}



