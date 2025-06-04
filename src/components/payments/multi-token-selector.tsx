'use client';

import React from 'react';
import { STABLECOINS, getSupportedStablecoins } from '@/utils/stablecoin-config';

interface MultiTokenSelectorProps {
  selectedTokens: string[];
  onTokensChange: (tokens: string[]) => void;
  disabled?: boolean;
}

export function MultiTokenSelector({ selectedTokens, onTokensChange, disabled = false }: MultiTokenSelectorProps) {
  const supportedTokens = getSupportedStablecoins();

  const handleTokenToggle = (token: string) => {
    if (selectedTokens.includes(token)) {
      // Remove token if already selected (but ensure at least one remains)
      if (selectedTokens.length > 1) {
        onTokensChange(selectedTokens.filter(t => t !== token));
      }
    } else {
      // Add token to selected list
      onTokensChange([...selectedTokens, token]);
    }
  };

  const selectAll = () => {
    onTokensChange(supportedTokens);
  };

  const selectUsdc = () => {
    onTokensChange(['USDC']);
  };

  return (
    <div className="form-control w-full max-w-xs">
      <label className="label py-1">
        <span className="label-text">Accepted Payment Tokens</span>
      </label>
      
      {/* Quick action buttons */}
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={selectUsdc}
          disabled={disabled}
        >
          USDC Only
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={selectAll}
          disabled={disabled}
        >
          Accept All
        </button>
      </div>

      {/* Token selection checkboxes */}
      <div className="space-y-2 p-3 border rounded-lg bg-base-100">
        {supportedTokens.map((token) => {
          const config = STABLECOINS[token];
          const isSelected = selectedTokens.includes(token);
          const isLastSelected = selectedTokens.length === 1 && isSelected;
          
          return (
            <label key={token} className="cursor-pointer label justify-start gap-3">
              <input
                type="checkbox"
                className="checkbox checkbox-primary"
                checked={isSelected}
                onChange={() => handleTokenToggle(token)}
                disabled={disabled || isLastSelected} // Prevent unchecking the last token
              />
              <span className="label-text flex items-center gap-2">
                <span className="text-lg">{config.icon}</span>
                <span>{config.name} ({token})</span>
              </span>
            </label>
          );
        })}
      </div>
      
      <label className="label">
        <span className="label-text-alt text-gray-500">
          Select which tokens customers can pay with
          {selectedTokens.length === 1 && (
            <span className="block text-warning mt-1">
              ⚠️ At least one token must be selected
            </span>
          )}
        </span>
      </label>
    </div>
  );
} 