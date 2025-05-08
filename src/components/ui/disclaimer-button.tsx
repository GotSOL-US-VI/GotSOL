'use client';

import { useDisclaimerContext } from './disclaimer-provider';
import { FeedbackLink } from './feedback-link';

export function DisclaimerButton() {
  const { openModal } = useDisclaimerContext();

  return (
    <div className="fixed bottom-4 left-4 flex gap-4">
      <button 
        onClick={openModal}
        className="text-sm text-white hover:text-gray-700"
      >
        Disclaimer
      </button>
      <FeedbackLink />
    </div>
  );
} 