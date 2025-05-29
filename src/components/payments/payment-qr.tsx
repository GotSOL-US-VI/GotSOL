'use client';

import React, { useState, useEffect, useCallback, ChangeEvent, useRef } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@getpara/react-sdk';
import Image from 'next/image';
import { usePaymentQR } from './use-payment-qr';
import { useSoundContext } from '@/components/sound/sound-context';

interface PaymentQRProps {
  merchantPubkey: PublicKey;
  isDevnet?: boolean;
  resetSignal?: number;
}

type NumberPadInput = string | 'backspace' | 'clear';

export function PaymentQR({ merchantPubkey, isDevnet = true, resetSignal }: PaymentQRProps) {
  const { data: wallet } = useWallet();
  const { playSound } = useSoundContext();
  const [amount, setAmount] = useState<string>('');
  const [memo, setMemo] = useState<string>('');
  const [qrCode, setQrCode] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [useNumpad, setUseNumpad] = useState<boolean>(false);
  const [showSuccessIcon, setShowSuccessIcon] = useState<boolean>(false);
  const isFirstRender = useRef(true);
  const prevResetSignal = useRef(resetSignal);

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

  const handleNumberPadInput = (value: NumberPadInput): void => {
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

  const handleKeyboardInput = (e: ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    if (!isValidAmount(value)) {
      return;
    }
    setAmount(value);
  };

  const handleMemoChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setMemo(e.target.value);
  };

  const { generatePaymentQR } = usePaymentQR();

  const generateQR = useCallback(async (): Promise<void> => {
    try {
      setError('');
      const numAmount = parseFloat(amount);

      if (isNaN(numAmount) || numAmount <= 0) {
        setError('Please enter a valid amount');
        return;
      }

      const trimmedMemo = memo.trim();
      const result = await generatePaymentQR(numAmount, merchantPubkey, isDevnet, trimmedMemo);

      if (result.error) {
        setError(result.error.message);
        return;
      }

      setQrCode(result.qrCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }, [amount, memo, merchantPubkey, isDevnet, generatePaymentQR]);

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

  // Reset state when resetSignal changes
  useEffect(() => {
    // Skip the effect on the initial render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevResetSignal.current = resetSignal;
      return;
    }

    // Only run if resetSignal actually changed from previous value
    if (resetSignal !== undefined && resetSignal !== prevResetSignal.current) {
      // Update stored value
      prevResetSignal.current = resetSignal;

      // Show the success icon
      setShowSuccessIcon(true);

      /**
       * Play the cash register sound when payment is received
       * Uses the global sound context to respect the user's mute preference
       * The actual sound file is located at /public/cash-register-sound-effect.mp3
       */
      playSound('/cash-register-sound-effect.mp3');

      // Clear the form fields
      setAmount('');
      setMemo('');
      setQrCode('');
      setError('');

      // Hide the success icon after 3.5 seconds
      const timer = setTimeout(() => {
        setShowSuccessIcon(false);
      }, 3500);

      // Clean up timer if component unmounts
      return () => clearTimeout(timer);
    }
  }, [resetSignal, playSound]);

  const renderNumberPad = (): React.ReactElement => (
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

        {showSuccessIcon ? (
          <div className="mt-4 flex flex-col items-center">
            <div className="success-icon bg-gradient-to-r from-green-400 to-green-600 shadow-lg rounded-full w-[250px] h-[250px] flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="150"
                height="150"
                viewBox="0 0 24 24"
                className="text-white"
                fill="currentColor"
              >
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
            </div>
            <p className="text-sm text-green-500 font-bold mt-2">
              Payment Received!
            </p>
          </div>
        ) : qrCode && (
          <div className="mt-4 flex flex-col items-center">
            <Image
              src={qrCode}
              alt="Payment QR Code"
              width={250}
              height={250}
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