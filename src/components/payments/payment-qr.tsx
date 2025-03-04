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
  const [memo, setMemo] = useState<string>('');
  const [qrCode, setQrCode] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [useNumpad, setUseNumpad] = useState<boolean>(false);
  const { generatePaymentQR } = usePaymentQR(program);

  // Validate USDC amount constraints
  const isValidAmount = (value: string): boolean => {
    // Don't allow empty strings
    if (!value) return true;
    
    // Must be a valid number
    if (!/^\d*\.?\d*$/.test(value)) return false;

    const parts = value.split('.');
    const wholeNum = parts[0];
    const decimals = parts[1] || '';

    // Whole number can't be more than 16 digits (reasonable USDC amount limit)
    if (wholeNum.length > 16) return false;
    
    // Decimals can't be more than 6 places (USDC decimal limit)
    if (decimals.length > 6) return false;

    return true;
  };

  const handleNumberPadInput = (value: string) => {
    if (value === 'backspace') {
      setAmount(prev => prev.slice(0, -1));
      return;
    }
    if (value === 'clear') {
      setAmount('');
      return;
    }

    const newAmount = amount + value;
    if (!isValidAmount(newAmount)) {
      return;
    }

    // Don't allow leading zeros unless it's a decimal
    if (amount === '0' && value !== '.') {
      setAmount(value);
      return;
    }

    setAmount(newAmount);
  };

  const handleKeyboardInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (!isValidAmount(value)) {
      return;
    }
    setAmount(value);
  };

  const handleGenerateQR = async () => {
    try {
      setError('');
      const numAmount = parseFloat(amount);
      
      if (isNaN(numAmount) || numAmount <= 0) {
        setError('Please enter a valid amount');
        return;
      }

      const trimmedMemo = memo.trim();
      const result = await generatePaymentQR(
        numAmount, 
        merchantPubkey, 
        isDevnet, 
        trimmedMemo || undefined
      );
      
      if (result.error) {
        setError(result.error.message);
        return;
      }

      setQrCode(result.qrCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const renderNumberPad = () => (
    <div className="grid grid-cols-3 gap-2 w-full mt-2">
      {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((num) => (
        <button
          key={num}
          className="btn btn-outline"
          onClick={() => handleNumberPadInput(num.toString())}
        >
          {num}
        </button>
      ))}
      <button
        className="btn btn-outline"
        onClick={() => handleNumberPadInput('.')}
      >
        .
      </button>
      <button
        className="btn btn-outline"
        onClick={() => handleNumberPadInput('0')}
      >
        0
      </button>
      <button
        className="btn btn-outline btn-error"
        onClick={() => handleNumberPadInput('backspace')}
      >
        ←
      </button>
    </div>
  );

  return (
    <div className="flex flex-col items-center space-y-2 p-4">
      <div className="form-control w-full max-w-xs">
        <div className="flex justify-between items-center mb-2">
          <label className="label py-1">
            <span className="label-text">Enter $ Amount in USDC</span>
          </label>
          <button
            className="btn btn-sm btn-ghost text-[#00b5ff]"
            onClick={() => setUseNumpad(!useNumpad)}
          >
            {useNumpad ? 'Use Keyboard' : 'Use Numpad'}
          </button>
        </div>
        <div className="input-group">
          <input
            type="text"
            inputMode="decimal"
            placeholder=""
            className="input input-bordered w-full text-xl text-center"
            value={amount}
            onChange={handleKeyboardInput}
            readOnly={useNumpad}
          />
        </div>

        {useNumpad && renderNumberPad()}
        
        <label className="label mt-4">
          <span className="label-text">Add a Memo (optional)</span>
        </label>
        <div className="input-group">
          <input
            type="text"
            placeholder="e.g., Coffee and pastries"
            className="input input-bordered w-full"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>

        <button 
          className="btn btn-primary mt-4 w-full"
          onClick={handleGenerateQR}
          disabled={!amount}
        >
          Generate QR Code
        </button>
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
            {memo && <p className="text-gray-500 mb-2">{memo}</p>}
            <img src={qrCode} alt="Payment QR Code" className="w-64 h-64" />
            {/* <p className="text-sm text-gray-500">
              Merchant receives: ${(parseFloat(amount) * 0.985).toFixed(2)} USDC
              <br />
              Platform fee: ${(parseFloat(amount) * 0.015).toFixed(2)} USDC
            </p> */}
          </div>
        </div>
      )}
    </div>
  );
} 