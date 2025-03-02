use anchor_lang::prelude::*;
use std::str::FromStr;

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::constants::*;
use crate::errors::*;
use crate::state::*;

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
        // Trim the name before storing
        let trimmed_name = name.trim().to_string();
        
        self.merchant.set_inner(Merchant {
            owner: self.owner.key(),
            entity_name: trimmed_name,
            merchant_bump: bumps.merchant,
        });
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct WithdrawUSDC<'info> {
    #[account(mut,
    constraint = owner.key() == merchant.owner @ CustomError::UnauthorizedWithdrawal,
    constraint = amount > 0 @ CustomError::InvalidAmount)]
    pub owner: Signer<'info>,

    #[account(seeds = [b"merchant", merchant.entity_name.as_str().as_bytes(), owner.key().as_ref()], bump = merchant.merchant_bump)]
    pub merchant: Account<'info, Merchant>,

    // main net USDC mint account
    // #[account(constraint = usdc_mint.key() == Pubkey::from_str(USDC_MAINNET_MINT).unwrap())]
    // pub usdc_mint: InterfaceAccount<'info, Mint>,

    // devnet USDC mint account
    #[account(constraint = usdc_mint.key() == Pubkey::from_str(USDC_DEVNET_MINT).unwrap())]
    pub usdc_mint: InterfaceAccount<'info, Mint>,

    #[account(mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = merchant,
        constraint = merchant_usdc_ata.amount >= amount @ CustomError::InsufficientFunds,
    )]
    pub merchant_usdc_ata: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: This is the HOUSE Squads multi-sig
    #[account(mut, constraint = house.key() == Pubkey::from_str(HOUSE).unwrap())]
    pub house: AccountInfo<'info>,

    #[account(mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = house
    )]
    pub house_usdc_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(init_if_needed, payer = owner,
        associated_token::mint = usdc_mint,
        associated_token::authority = owner
    )]
    pub owner_usdc_ata: InterfaceAccount<'info, TokenAccount>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> WithdrawUSDC<'info> {
    pub fn withdraw(&mut self, amount: u64) -> Result<()> {
        let owner_amount = (amount * MERCHANT_SHARE) / 1000;
        let house_amount = amount - owner_amount;

        // create an object for the owner key and reference it in the seeds
        let owner_key = self.owner.key();

        // Create seeds once
        let seeds: &[&[&[u8]]] = &[&[
            b"merchant",
            self.merchant.entity_name.as_bytes(),
            owner_key.as_ref(),
            &[self.merchant.merchant_bump],
        ]];

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
                seeds,
            ),
            owner_amount,
            self.usdc_mint.decimals,
        )?;

        // Transfer the house's share
        anchor_spl::token_interface::transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                anchor_spl::token_interface::TransferChecked {
                    from: self.merchant_usdc_ata.to_account_info(),
                    mint: self.usdc_mint.to_account_info(),
                    to: self.house_usdc_ata.to_account_info(),
                    authority: self.merchant.to_account_info(),
                },
                seeds,
            ),
            house_amount,
            self.usdc_mint.decimals,
        )?;

        Ok(())
    }
}
