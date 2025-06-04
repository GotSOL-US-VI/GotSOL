'use client';

import React from 'react';
import { STABLECOINS, getSupportedStablecoins } from '@/utils/stablecoin-config';

interface TokenSelectorProps {
  selectedToken: string;
  onTokenChange: (token: string) => void;
  disabled?: boolean;
}

export function TokenSelector({ selectedToken, onTokenChange, disabled = false }: TokenSelectorProps) {
  const supportedTokens = getSupportedStablecoins();

  return (
    <div className="form-control w-full max-w-xs">
      <label className="label py-1">
        <span className="label-text">Payment Token</span>
      </label>
      <select 
        className="select select-bordered w-full"
        value={selectedToken}
        onChange={(e) => onTokenChange(e.target.value)}
        disabled={disabled}
      >
        {supportedTokens.map((token) => {
          const config = STABLECOINS[token];
          return (
            <option key={token} value={token}>
              {config.icon} {config.name} ({token})
            </option>
          );
        })}
      </select>
      <label className="label">
        <span className="label-text-alt text-gray-500">
          Choose which stablecoin to accept
        </span>
      </label>
    </div>
  );
} 