'use client';

import { useDisclaimerContext } from './disclaimer-provider';

export function DisclaimerButton() {
  const { openModal } = useDisclaimerContext();

  return (
    <button 
      onClick={openModal}
      className="text-sm text-white hover:text-gray-700"
    >
      Disclaimer
    </button>
  );
} 