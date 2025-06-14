use anchor_lang::prelude::*;

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

// use std::str::FromStr;

use crate::state::Merchant;
// use crate::constants::*;
use crate::errors::*;
use crate::events::*;

/*
THIS IS A TEMPORARY CONTEXT AND WILL BE DELETED/REFACTORED LATER ONCE WE DON'T NEED IT ANYMORE!
merchant pays the gov it's entire compliance_escrow balance 
taxes are being paid in USDC only for now, not any other token such as USDT
*/

#[derive(Accounts)]
pub struct PayTaxes<'info> {

    // our node's fee payer
    #[account(mut)]
    pub fee_payer: Option<Signer<'info>>,

    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [b"merchant", merchant.entity_name.as_str().as_bytes(), owner.key().as_ref()], 
        bump = merchant.merchant_bump,
    )]
    pub merchant: Box<Account<'info, Merchant>>,

    // devnet USDC mint account
    // #[account(constraint = usdc_mint.key() == Pubkey::from_str(USDC_DEVNET_MINT).unwrap())]
    pub usdc_mint: InterfaceAccount<'info, Mint>,

    #[account(mut, 
        seeds = [b"compliance_escrow", merchant.key().as_ref()],
        bump = merchant.compliance_bump,
        token::mint = usdc_mint,
        token::authority = merchant
    )]
    pub compliance_escrow: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(init_if_needed, 
        payer = fee_payer.as_ref().unwrap_or(&owner),
        associated_token::mint = usdc_mint,
        associated_token::authority = gov
    )]
    pub gov_usdc_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: this is the gov's pubkey
    // #[account(constraint = gov.key() == Pubkey::from_str(GOV).unwrap())]
    pub gov: AccountInfo<'info>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> PayTaxes<'info> {
    pub fn pay_taxes(&mut self) -> Result<()> {
        let amount = self.compliance_escrow.amount;
        
        // Validate amount
        require!(amount > 0, CustomError::InvalidWithdrawalAmount);

        let owner_key = self.owner.key();
        let seeds = &[
            b"merchant".as_ref(),
            self.merchant.entity_name.as_bytes(),
            owner_key.as_ref(),
            &[self.merchant.merchant_bump],
        ];

        // Transfer entire compliance escrow balance to government
        self.transfer_spl_tokens(&self.gov_usdc_ata.to_account_info(), amount, seeds)?;

        // Emit event
        emit!(TaxesPaid {
            amount,
            merchant: self.merchant.key(),
            gov: self.gov.key(),
            mint: self.usdc_mint.key(),
        });

        Ok(())
    }

    /// Helper function to transfer SPL tokens from compliance escrow
    fn transfer_spl_tokens(&self, to: &AccountInfo<'info>, amount: u64, seeds: &[&[u8]]) -> Result<()> {
        anchor_spl::token_interface::transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                anchor_spl::token_interface::TransferChecked {
                    from: self.compliance_escrow.to_account_info(),
                    mint: self.usdc_mint.to_account_info(),
                    to: to.clone(),
                    authority: self.merchant.to_account_info(),
                },
                &[seeds],
            ),
            amount,
            self.usdc_mint.decimals,
        )
    }
}