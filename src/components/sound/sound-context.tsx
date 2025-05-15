'use client';

/**
 * @file sound-context.tsx
 * @description
 * This context provides app-wide access to sound management functionality.
 * 
 * Purpose:
 * - Creates a global context for managing sound settings across the entire application
 * - Makes sound settings (particularly the mute state) accessible to any component
 * - Ensures sound preferences are consistently applied throughout the app
 * - Centralizes sound management to avoid duplicate code and inconsistent behaviors
 * 
 * The context specifically manages:
 * - The current muted state
 * - Functions to toggle or set the mute state
 * - A utility function to play sounds only when not muted
 * 
 * This was implemented to allow the cash register sound to be toggled on/off
 * from anywhere in the application, while ensuring the setting persists and
 * is respected by all components that play sounds.
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { useSoundSettings } from '@/hooks/use-sound-settings';

// Define the context type
interface SoundContextType {
  isMuted: boolean;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
  playSound: (soundPath: string) => void;
}

// Create context with a default value
const SoundContext = createContext<SoundContextType | undefined>(undefined);

/**
 * Provider component that makes sound settings available throughout the app
 * @param {ReactNode} children - Child components that will have access to the sound context
 */
export function SoundProvider({ children }: { children: ReactNode }) {
  const soundSettings = useSoundSettings();

  return (
    <SoundContext.Provider value={soundSettings}>
      {children}
    </SoundContext.Provider>
  );
}

/**
 * Hook to use the sound context in any component
 * @returns {SoundContextType} The sound context containing mute state and control functions
 * @throws {Error} If used outside of a SoundProvider
 */
export function useSoundContext() {
  const context = useContext(SoundContext);
  
  if (context === undefined) {
    throw new Error('useSoundContext must be used within a SoundProvider');
  }
  
  return context;
} 