'use client';

import React from 'react';
import Image from 'next/image';

export type SupportedToken = 'USDC' | 'USDT' | 'FDUSD' | 'USDG' | 'SOL';

interface TokenSelectorProps {
  selectedToken: SupportedToken;
  onTokenSelect: (token: SupportedToken) => void;
}

interface TokenConfig {
  symbol: SupportedToken;
  name: string;
  icon: string;
  bgColor: string;
  textColor: string;
}

const TOKENS: TokenConfig[] = [
  {
    symbol: 'SOL',
    name: 'Solana',
    icon: '/icons/branding/solanaLogoMark.svg',
    bgColor: 'bg-gradient-to-r from-purple-400 to-purple-600',
    textColor: 'text-purple-400'
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    icon: '/icons/branding/Token Logo/USDC Token.svg',
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-500'
  },
  {
    symbol: 'USDT',
    name: 'Tether',
    icon: '/icons/branding/tether logo.svg',
    bgColor: 'bg-green-500/10',
    textColor: 'text-green-500'
  },
  {
    symbol: 'FDUSD',
    name: 'First Digital USD',
    icon: '/icons/branding/fdusd-logo-03.svg',
    bgColor: 'bg-purple-500/10',
    textColor: 'text-purple-500'
  },
  {
    symbol: 'USDG',
    name: 'USDG Stablecoin',
    icon: '/icons/branding/USDG Token/SVG/GDN_USDG_Token.svg',
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-500'
  }
];

export function TokenSelector({ selectedToken, onTokenSelect }: TokenSelectorProps) {
    return (
    <div className="w-full mb-3">
      <label className="label py-0.5" id="token-selector-label">
        <span className="label-text text-sm">Select Token to Receive</span>
      </label>
      <div 
        className="grid grid-cols-5 gap-1.5 p-1.5 bg-base-200 rounded-lg" 
        role="radiogroup" 
        aria-labelledby="token-selector-label"
      >
        {TOKENS.map((token) => {
          const isSelected = selectedToken === token.symbol;
          
          return (
            <button
              key={token.symbol}
              onClick={() => onTokenSelect(token.symbol)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onTokenSelect(token.symbol);
                }
              }}
              className={`
                flex flex-col items-center justify-center gap-0.5 p-1.5 rounded-md
                transition-all duration-200 ease-in-out focus:ring-2 focus:ring-primary focus:outline-none
                ${isSelected 
                  ? 'bg-primary text-primary-content shadow-md transform scale-105' 
                  : 'bg-base-100 hover:bg-base-300 hover:transform hover:scale-102'
                }
              `}
              aria-label={`Select ${token.name} (${token.symbol}) for payment`}
              aria-checked={isSelected}
              role="radio"
              tabIndex={isSelected ? 0 : -1}
            >
              <div className={`${token.symbol === 'FDUSD' ? 'w-8 h-8' : 'w-5 h-5'} relative`}>
                <Image
                  src={token.icon}
                  alt={`${token.symbol} logo`}
                  width={token.symbol === 'FDUSD' ? 32 : 20}
                  height={token.symbol === 'FDUSD' ? 32 : 20}
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-xs font-medium">
                {token.symbol}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
} 