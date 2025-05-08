'use client';

import { useDisclaimerContext } from './disclaimer-provider';

export function DisclaimerButton() {
  const { openModal } = useDisclaimerContext();

  return (
    <button 
      onClick={openModal}
      className="text-sm transition-opacity"
    >
      Disclaimer
    </button>
  );
} 