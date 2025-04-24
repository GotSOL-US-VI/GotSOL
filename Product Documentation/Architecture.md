# Architecture

### Authentication Layer

- Uses Para wallet for social sign-on (email/phone/etc.)
- Provides a seamless, non-crypto-native UX for merchants
- No need for merchants to manage private keys

### Merchant Onboarding

- One-time flow to create a Merchant account
- Links the merchant's identity from Para to their on-chain Merchant account
- Creates necessary token accounts (USDC ATA)

### Payment Flow

- Simple UI for merchants to:
  - Input order amount
  - Generate QR code instantly
- Customer scans QR with any Solana wallet
- Payment automatically splits between merchant (99%) and house (1%)
- Zero gas fees for merchants (house covers these)

### Modularity

- Nothing hardcoded to specific merchants
- System can scale to any number of merchants
- Same tooling works for all merchants regardless of location/size
