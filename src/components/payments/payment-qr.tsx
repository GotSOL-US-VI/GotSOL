'use client';

import React, { useState, useEffect, useCallback, ChangeEvent, useRef } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@getpara/react-sdk';
import Image from 'next/image';
import { usePaymentQR } from './use-payment-qr';
import { useSoundContext } from '@/components/sound/sound-context';
import { TokenSelector, SupportedToken } from './token-selector';

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
  const [selectedToken, setSelectedToken] = useState<SupportedToken>('USDC');
  const [solAmountInfo, setSolAmountInfo] = useState<{ solAmount: number; solPrice: number; expiresAt: number } | null>(null);
  const isFirstRender = useRef(true);
  const prevResetSignal = useRef(resetSignal);

  // Validate amount constraints (generalized for all tokens)
  const isValidAmount = (value: string): boolean => {
    // Don't allow empty strings
    if (!value) return true;

    // Must be a valid number
    if (!/^\d*\.?\d*$/.test(value)) return false;

    const parts = value.split('.');
    const wholeNum = parts[0];
    const decimals = parts[1] || '';

    // Whole number can't be more than 16 digits (reasonable amount limit)
    if (wholeNum.length > 16) return false;

    // Decimals can't be more than 6 places (most stablecoins use 6 decimals)
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
      const result = await generatePaymentQR(numAmount, merchantPubkey, isDevnet, trimmedMemo, selectedToken);

      if (result.error) {
        setError(result.error.message);
        return;
      }

      setQrCode(result.qrCode);
      setSolAmountInfo(result.solAmountInfo || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }, [amount, memo, merchantPubkey, isDevnet, generatePaymentQR, selectedToken]);

  // Auto-generate QR code when amount, memo, or selected token changes
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
  }, [amount, memo, selectedToken, generateQR]);

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
      setSolAmountInfo(null);

      // Hide the success icon after 3.5 seconds
      const timer = setTimeout(() => {
        setShowSuccessIcon(false);
      }, 3500);

      // Clean up timer if component unmounts
      return () => clearTimeout(timer);
    }
  }, [resetSignal, playSound]);

  const renderNumberPad = (): React.ReactElement => (
    <div className="grid grid-cols-3 gap-3 w-full mt-3" role="group" aria-label="Number pad for amount input">
      {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((num) => (
        <button
          key={num}
          className="btn btn-outline text-lg h-12"
          onClick={() => handleNumberPadInput(num.toString())}
          aria-label={`Enter number ${num}`}
        >
          {num}
        </button>
      ))}
      <button
        className="btn btn-outline text-lg h-12"
        onClick={() => handleNumberPadInput('.')}
        aria-label="Enter decimal point"
      >
        .
      </button>
      <button
        className="btn btn-outline text-lg h-12"
        onClick={() => handleNumberPadInput('0')}
        aria-label="Enter number 0"
      >
        0
      </button>
      <button
        className="btn btn-outline btn-error text-lg h-12"
        onClick={() => handleNumberPadInput('backspace')}
        aria-label="Delete last digit"
      >
        ←
      </button>
    </div>
  );

  return (
    <div className="flex flex-col items-center space-y-3 p-5">
      <div className="form-control w-full max-w-sm">
        <TokenSelector 
          selectedToken={selectedToken}
          onTokenSelect={setSelectedToken}
        />
        <div className="flex justify-between items-center mb-3">
          <label className="label py-1">
            <span className="label-text text-base">Enter $ Amount</span>
          </label>
          <button
            className="btn btn-sm btn-ghost text-[#00b5ff]"
            onClick={() => setUseNumpad(!useNumpad)}
            aria-label={useNumpad ? 'Switch to keyboard input' : 'Switch to number pad input'}
          >
            {useNumpad ? 'Use Keyboard' : 'Use Numpad'}
          </button>
        </div>
        <div className="input-group">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            className="input input-bordered w-full text-2xl text-center"
            value={amount}
            onChange={handleKeyboardInput}
            readOnly={useNumpad}
            aria-label="Payment amount in dollars"
            aria-describedby="amount-help"
          />
        </div>
        <div id="amount-help" className="sr-only">
          Enter the payment amount in dollars
        </div>

        {useNumpad && renderNumberPad()}

        <label className="label mt-4">
          <span className="label-text text-base">Add a Memo (optional)</span>
        </label>
        <div className="input-group">
          <input
            type="text"
            placeholder="e.g., Coffee and pastries"
            className="input input-bordered w-full text-base"
            value={memo}
            onChange={handleMemoChange}
            aria-label="Payment memo or description"
            aria-describedby="memo-help"
          />
        </div>
        <div id="memo-help" className="sr-only">
          Optional description for this payment
        </div>

        {error && (
          <div className="text-error text-sm mt-2">{error}</div>
        )}

        {showSuccessIcon ? (
          <div className="mt-5 flex flex-col items-center">
            <div className="success-icon bg-gradient-to-r from-green-400 to-green-600 shadow-lg rounded-full w-[275px] h-[275px] flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="165"
                height="165"
                viewBox="0 0 24 24"
                className="text-white"
                fill="currentColor"
              >
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
            </div>
            <p className="text-base text-green-500 font-bold mt-3">
              Payment Received!
            </p>
          </div>
        ) : qrCode && (
          <div className="mt-5 flex flex-col items-center">
            <Image
              src={qrCode}
              alt="Payment QR Code"
              width={275}
              height={275}
              className="rounded-lg"
            />
            {selectedToken === 'SOL' && solAmountInfo ? (
              <div className="text-center mt-3">
                <p className="text-base text-gray-500">
                  Scan to pay {solAmountInfo.solAmount.toFixed(6)} SOL
                </p>
                <p className="text-sm text-gray-400">
                  ~${amount} USD @ ${solAmountInfo.solPrice.toFixed(2)}/SOL
                </p>
                <p className="text-xs text-gray-400">
                  Price expires: {new Date(solAmountInfo.expiresAt).toLocaleTimeString()}
                </p>
              </div>
            ) : (
              <p className="text-base text-gray-500 mt-3">
                Scan to pay ${amount} {selectedToken}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 