use anchor_lang::prelude::*;

// Constants for maximum string lengths
pub const MAX_ENTITY_NAME_LEN: usize = 32;
pub const MAX_TX_SIG_LEN: usize = 88; // Base58 signature length
pub const MAX_CONTACTS: usize = 5; // Maximum number of contacts per account

// Slot calculations for 48 hours
// 48 hours = 172,800 seconds
// 400ms per slot = 0.4 seconds per slot  
// 48 hours = 432,000 slots
pub const SLOTS_PER_48_HOURS: u64 = 432_000;

#[account]
pub struct Merchant {
    pub owner: Pubkey,
    pub entity_name: String,
    pub fee_eligible: bool,
    pub merchant_bump: u8,
    pub vault_bump: u8
}

impl Merchant {
    pub const LEN: usize = 8 + 32 + (4 + MAX_ENTITY_NAME_LEN) + 1 + 1 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct ContactEntry {
    pub pubkey: Pubkey,
    pub slot: u64,
}

impl ContactEntry {
    pub const LEN: usize = 32 + 8; // Pubkey (32) + slot (8)
}

#[account]
pub struct Contacts {
    pub contacts: Vec<ContactEntry>,
    pub bump: u8,
}

impl Contacts {
    // 8 (discriminator) + 4 (vec length) + (MAX_CONTACTS * ContactEntry::LEN) + 1 (bump)
    pub const LEN: usize = 8 + 4 + (MAX_CONTACTS * ContactEntry::LEN) + 1;
    
    pub fn add_contact(&mut self, pubkey: Pubkey, clock: &Clock) -> Result<()> {
        require!(self.contacts.len() < MAX_CONTACTS, crate::errors::CustomError::ContactsLimitReached);
        
        // Check if contact already exists - FAIL if it does
        require!(
            !self.contacts.iter().any(|c| c.pubkey == pubkey),
            crate::errors::CustomError::ContactAlreadyExists
        );
        
        // Calculate slot as current slot + 48 hours worth of slots
        let target_slot = clock.slot.checked_add(SLOTS_PER_48_HOURS)
            .ok_or(crate::errors::CustomError::ArithmeticOverflow)?;
        
        // Add new contact (we know it doesn't exist from check above)
        self.contacts.push(ContactEntry { pubkey, slot: target_slot });
        
        Ok(())
    }
    
    pub fn remove_contact(&mut self, pubkey: Pubkey) -> Result<()> {
        if let Some(pos) = self.contacts.iter().position(|c| c.pubkey == pubkey) {
            self.contacts.remove(pos);
        }
        Ok(())
    }
    
    pub fn is_valid_contact(&self, pubkey: Pubkey, current_slot: u64) -> bool {
        self.contacts
            .iter()
            .find(|c| c.pubkey == pubkey)
            .map(|c| current_slot >= c.slot)
            .unwrap_or(false)
    }
    
    pub fn get_contact_slot(&self, pubkey: Pubkey) -> Option<u64> {
        self.contacts
            .iter()
            .find(|c| c.pubkey == pubkey)
            .map(|c| c.slot)
    }
}

#[account]
pub struct RefundRecord {
    pub original_tx_sig: String,
    pub bump: u8,
}

impl RefundRecord {
    pub const LEN: usize = 8 + (4 + MAX_TX_SIG_LEN) + 1;
}

#[account]
pub struct CloseContactsRecord {
    pub slot: u64,
    pub bump: u8,
}

impl CloseContactsRecord {
    pub const LEN: usize = 8 + 8 + 1;
}