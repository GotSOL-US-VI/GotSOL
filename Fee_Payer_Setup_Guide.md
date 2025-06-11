# Solana Pay Fee Payer Setup Guide

## Overview

Your new Solana Pay implementation uses the **Transaction Request** pattern instead of the direct transfer pattern. This enables:

- **Fee sponsorship**: Your server pays transaction fees and ATA creation costs
- **Better UX**: Customers don't pay any fees
- **Wallet compatibility**: Works with any Solana wallet (hot, MPC, hardware, etc.)

## How It Works

### Before (Direct Transfer):
```
QR Code → Wallet → Direct USDC transfer to merchant ATA
```
**Problems**: Customer pays fees, customer pays ATA creation, no control

### After (Transaction Request):
```
QR Code → Wallet → Your API → Signed transaction with fee payer → Wallet
```
**Benefits**: You control fees, better UX, merchant ATA auto-creation

## Setup Instructions

### 1. Generate Fee Payer Keypair

```bash
# Generate a new keypair for fee paying
solana-keygen new --outfile fee-payer.json

# Get the public key
solana-keygen pubkey fee-payer.json

# Get the private key in base58 format
cat fee-payer.json | jq '.[]' | xargs printf "%d " | python3 -c "
import sys
import base58
data = [int(x) for x in sys.stdin.read().strip().split()]
print(base58.b58encode(bytes(data)).decode())
"
```

### 2. Add to Environment Variables

Add to your `.env.local`:

```bash
# Fee Payer for Solana Pay transactions
FEE_PAYER_PRIVATE_KEY=your_base58_private_key_here

# Production URL for Solana Pay
NEXT_PUBLIC_PRODUCTION_URL=https://gotsol-opal.vercel.app
```

### 3. Fund the Fee Payer

#### For Devnet:
```bash
# Fund with devnet SOL
solana airdrop 5 --keypair fee-payer.json --url devnet
```

#### For Mainnet:
```bash
# Send real SOL to the fee payer address
# You'll need enough SOL to cover transaction fees for your users
```

### 4. Deploy Configuration

When deploying to Vercel, add these environment variables:
- `FEE_PAYER_PRIVATE_KEY`
- `NEXT_PUBLIC_PRODUCTION_URL`

## Cost Analysis

### Typical Transaction Costs (Devnet/Mainnet):

1. **Base transaction fee**: ~0.000005 SOL ($0.001)
2. **ATA creation** (if needed): ~0.002 SOL ($0.40)
3. **Compute units**: Minimal additional cost

### Monthly estimates for a busy merchant:
- **100 transactions/month**: ~$0.10 in fees
- **50 new ATAs/month**: ~$20 in ATA creation
- **Total**: ~$20.10/month per active merchant

## Implementation Details

### API Endpoints Created:

1. **`/api/payment/transaction`**: Handles transaction requests
2. **`/api/payment/icon`**: Provides Solana Action icon

### Transaction Flow:

1. Customer scans QR code
2. Wallet requests transaction from your API
3. API creates transaction with fee payer
4. API partially signs with fee payer keypair
5. Wallet signs customer's portion
6. Transaction submitted to network

### Fallback Behavior:

If `FEE_PAYER_PRIVATE_KEY` is not set:
- Customers pay their own fees (original behavior)
- Still creates merchant ATA if needed
- Graceful degradation

## Security Considerations

### Fee Payer Security:
- Store private key securely (environment variable)
- Monitor SOL balance regularly
- Consider rate limiting to prevent abuse
- Rotate keypairs periodically

### Transaction Validation:
- API validates all transaction parameters
- Prevents unauthorized token transfers
- Amount limits can be added if needed

## Monitoring & Maintenance

### Daily Tasks:
```bash
# Check fee payer balance
solana balance --keypair fee-payer.json --url devnet

# Monitor transaction costs
solana transaction-history --keypair fee-payer.json --limit 10
```

### Alerts to Set Up:
- Fee payer balance below threshold
- Unusual transaction volume
- Failed transaction rate spikes

## Testing

### Test with Different Wallets:
1. **Phantom Mobile**: Scan QR code
2. **Backpack**: Test transaction flow
3. **Solflare**: Verify compatibility
4. **Web wallets**: Ensure broad support

### Verify Fee Coverage:
1. Create transaction with new merchant (ATA creation)
2. Check customer paid $0 in fees
3. Verify merchant received full payment amount
4. Confirm fee payer balance decreased

## Troubleshooting

### Common Issues:

**"FEE_PAYER_PRIVATE_KEY not found"**
- Add environment variable to `.env.local`
- Restart development server

**"Insufficient funds for fee payer"**
- Fund fee payer with SOL
- Check balance regularly

**"Transaction failed"**
- Check RPC endpoint status
- Verify network (devnet vs mainnet)
- Ensure customer has sufficient USDC

**"ATA creation failed"**
- Ensure fee payer has enough SOL
- Check merchant public key validity

## Next Steps

1. **Set up fee payer keypair**
2. **Fund with SOL**
3. **Test with different wallets**
4. **Monitor costs and usage**
5. **Deploy to production**

## Alternative Fee Payer Patterns

For high-volume merchants, consider:

1. **Per-merchant fee payers**: Each merchant funds their own
2. **Subscription model**: Monthly fee covers all transactions
3. **Hybrid model**: You cover small transactions, merchant covers large ones

This implementation gives you maximum flexibility and the best possible UX for your customers! 