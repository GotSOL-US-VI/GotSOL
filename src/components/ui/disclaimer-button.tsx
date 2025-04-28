'use client';

import { useDisclaimerContext } from './disclaimer-provider';

export function DisclaimerButton() {
  const { openModal } = useDisclaimerContext();

  return (
    <button 
      onClick={openModal}
      className="fixed bottom-4 left-4 text-sm text-white hover:text-gray-700"
    >
      Disclaimer
    </button>
  );
} 