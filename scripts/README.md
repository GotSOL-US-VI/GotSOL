# Fee Payer System

This system allows you to use a local private key as a fee payer for transactions in your Solana application.

## Setup

1. Add your fee payer private key to your `.env.local` file:

```
FEE_PAYER_PRIVATE_KEY=[1,2,3,...]  # 64 numbers representing your private key
```

2. Make sure your RPC URL is set in your `.env.local` file:

```
NEXT_PUBLIC_HELIUS_RPC_URL=https://devnet.helius-rpc.com/?api-key=your-api-key
```

## How It Works

1. When a transaction is initiated in the UI, it's serialized and passed to the `sign-transaction.ts` script.
2. The script deserializes the transaction, signs it with the fee payer's private key, and sends it to the network.
3. The transaction signature is returned to the UI.

## Security Considerations

- The private key is stored in your `.env.local` file, which should never be committed to version control.
- If the private key is compromised, you can simply replace it with a new one.
- For production environments, consider using a more secure key management solution.

## Usage

The system is already integrated with the following components:

- `CreateMerchant`
- `MakeRevenuePaymentButton`
- `WithdrawFunds`

No additional configuration is needed to use these components with the fee payer system. 