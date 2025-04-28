'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useDisclaimerModal } from '@/hooks/use-disclaimer-modal';
import { DisclaimerModal } from './disclaimer-modal';

const DisclaimerContext = createContext<ReturnType<typeof useDisclaimerModal> | null>(null);

export function useDisclaimerContext() {
  const context = useContext(DisclaimerContext);
  if (!context) {
    throw new Error('useDisclaimerContext must be used within a DisclaimerProvider');
  }
  return context;
}

export function DisclaimerProvider({ children }: { children: ReactNode }) {
  const modalState = useDisclaimerModal();

  return (
    <DisclaimerContext.Provider value={modalState}>
      {children}
      <DisclaimerModal isOpen={modalState.isOpen} onClose={modalState.closeModal} />
    </DisclaimerContext.Provider>
  );
} 