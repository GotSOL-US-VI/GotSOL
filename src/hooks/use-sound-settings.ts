'use client';

/**
 * @file use-sound-settings.ts
 * @description
 * This hook provides sound management functionality throughout the application.
 * 
 * Key features:
 * - Manages a global mute state for all application sounds
 * - Persists sound settings in localStorage for consistency across sessions
 * - Provides a utility function to conditionally play sounds only when not muted
 * - Built with a toggle function for easy integration with UI components
 * 
 * This was created to allow users to mute the "cha-ching" cash register sound
 * that plays when a payment is received, but is designed to be extensible for
 * any future sounds added to the application.
 */

import { useEffect, useState } from 'react';
import { useMounted } from './use-mounted';

interface UseSoundSettingsReturn {
  isMuted: boolean;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
  playSound: (soundPath: string) => void;
}

/**
 * Hook to manage sound settings with localStorage persistence
 * @returns {UseSoundSettingsReturn} Object containing sound control functions and state
 */
export function useSoundSettings(): UseSoundSettingsReturn {
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const mounted = useMounted();

  // Initialize from localStorage on mount
  useEffect(() => {
    if (!mounted) return;
    
    const savedMuteState = localStorage.getItem('soundMuted');
    if (savedMuteState !== null) {
      setIsMuted(savedMuteState === 'true');
    }
  }, [mounted]);

  /**
   * Toggles the current mute state
   */
  const toggleMute = () => {
    setMuted(!isMuted);
  };

  /**
   * Sets the mute state and persists it to localStorage
   * @param muted - The mute state to set
   */
  const setMuted = (muted: boolean) => {
    setIsMuted(muted);
    localStorage.setItem('soundMuted', muted.toString());
  };

  /**
   * Plays a sound file if the application is not muted
   * @param soundPath - Path to the sound file relative to the public directory
   */
  const playSound = (soundPath: string) => {
    if (!isMuted) {
      const audio = new Audio(soundPath);
      audio.play().catch(err => {
        console.error('Error playing sound:', err);
      });
    }
  };

  return { isMuted, toggleMute, setMuted, playSound };
} 