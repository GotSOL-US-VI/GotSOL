'use client';

import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@getpara/react-sdk';
import Image from 'next/image';

interface PaymentQRProps {
  merchantPubkey: PublicKey;
  isDevnet?: boolean;
}

export function PaymentQR({ merchantPubkey, isDevnet = true }: PaymentQRProps) {
  const { data: wallet } = useWallet();
  const [amount, setAmount] = useState<string>('');
  const [memo, setMemo] = useState<string>('');
  const [qrCode, setQrCode] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [useNumpad, setUseNumpad] = useState<boolean>(false);

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

  const handleMemoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMemo(e.target.value);
  };

  const generateQR = useCallback(async () => {
    try {
      setError('');
      const numAmount = parseFloat(amount);
      
      if (isNaN(numAmount) || numAmount <= 0) {
        setError('Please enter a valid amount');
        return;
      }

      const trimmedMemo = memo.trim();
      
      // TODO: Implement QR code generation using Para's payment API
      // This will need to be implemented based on your specific requirements
      // and Para's available methods for generating payment QR codes
      const result = {
        qrCode: 'placeholder-qr-code',
        error: null
      };
      
      if (result.error) {
        setError(result.error.message);
        return;
      }

      setQrCode(result.qrCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }, [amount, memo, merchantPubkey, isDevnet]);

  // Auto-generate QR code when amount or memo changes
  useEffect(() => {
    // Only generate if we have a valid amount
    if (!amount || parseFloat(amount) <= 0) {
      return;
    }

    // Use a debounce to avoid generating QR codes too frequently
    const debounceTimer = setTimeout(() => {
      generateQR();
    }, 500); // 500ms debounce

    return () => clearTimeout(debounceTimer);
  }, [amount, memo, generateQR]);

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
            onChange={handleMemoChange}
          />
        </div>

        {error && (
          <div className="text-error text-sm mt-2">{error}</div>
        )}

        {qrCode && (
          <div className="mt-4 flex flex-col items-center">
            <Image
              src={qrCode}
              alt="Payment QR Code"
              width={200}
              height={200}
              className="rounded-lg"
            />
            <p className="text-sm text-gray-500 mt-2">
              Scan to pay {amount} USDC
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 