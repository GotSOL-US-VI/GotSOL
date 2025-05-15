'use client';

/**
 * @file sound-toggle.tsx
 * @description
 * A toggleable button component that controls the application's sound mute state.
 * 
 * Features:
 * - Displays an icon indicating the current mute state (muted or unmuted)
 * - Toggles the global sound mute state when clicked
 * - Provides a tooltip indicating the action that will be taken on click
 * - Can receive additional class names for custom styling in different contexts
 * 
 * This component uses SVG icons to visually represent the muted/unmuted state:
 * - Speaker with X icon when muted
 * - Speaker with waves icon when unmuted
 * 
 * This component was created to give users an intuitive way to toggle the
 * cash register sound that plays when a payment is received.
 */

import React from 'react';
import { useSoundContext } from './sound-context';

interface SoundToggleProps {
  className?: string;
}

/**
 * A button that toggles the application's sound mute state
 * @param {string} className - Optional additional CSS classes
 * @returns {JSX.Element} A button with appropriate mute/unmute icon
 */
export function SoundToggle({ className = '' }: SoundToggleProps) {
  const { isMuted, toggleMute } = useSoundContext();

  return (
    <button
      className={`btn btn-ghost btn-sm ${className}`}
      onClick={toggleMute}
      title={isMuted ? "Unmute sound" : "Mute sound"}
    >
      {isMuted ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
          <line x1="23" y1="9" x2="17" y2="15"></line>
          <line x1="17" y1="9" x2="23" y2="15"></line>
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
        </svg>
      )}
    </button>
  );
} 