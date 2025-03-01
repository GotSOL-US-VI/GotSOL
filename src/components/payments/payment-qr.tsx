'use client';

import { useState } from 'react';
import { Program, Idl } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { usePaymentQR } from './use-payment-qr';

interface PaymentQRProps {
  program: Program<Idl>;
  merchantPubkey: PublicKey;
  isDevnet?: boolean;
}

export function PaymentQR({ program, merchantPubkey, isDevnet = true }: PaymentQRProps) {
  const [amount, setAmount] = useState<string>('');
  const [qrCode, setQrCode] = useState<string>('');
  const [error, setError] = useState<string>('');
  const { generatePaymentQR } = usePaymentQR(program);

  const handleGenerateQR = async () => {
    try {
      setError('');
      const numAmount = parseFloat(amount);
      
      if (isNaN(numAmount) || numAmount <= 0) {
        setError('Please enter a valid amount');
        return;
      }

      const result = await generatePaymentQR(numAmount, merchantPubkey, isDevnet);
      
      if (result.error) {
        setError(result.error.message);
        return;
      }

      setQrCode(result.qrCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4 p-4">
      <div className="form-control w-full max-w-xs">
        <label className="label">
          <span className="label-text">Amount in USDC</span>
        </label>
        <div className="input-group">
          <span>$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            className="input input-bordered w-full"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button 
            className="btn btn-primary"
            onClick={handleGenerateQR}
            disabled={!amount}
          >
            Generate QR
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {qrCode && (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body items-center text-center">
            <h2 className="card-title">Scan to Pay ${amount} USDC</h2>
            <img src={qrCode} alt="Payment QR Code" className="w-64 h-64" />
            <p className="text-sm text-gray-500">
              Merchant receives: ${(parseFloat(amount) * 0.985).toFixed(2)} USDC
              <br />
              Platform fee: ${(parseFloat(amount) * 0.015).toFixed(2)} USDC
            </p>
          </div>
        </div>
      )}
    </div>
  );
} 