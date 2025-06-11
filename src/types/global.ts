// Global window extensions
declare global {
  interface Window {
    gtag?: (
      command: 'event',
      action: string,
      parameters: {
        description: string;
        fatal: boolean;
      }
    ) => void;
  }
}

// Type guard for gtag availability
export function hasGtag(): boolean {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
}

// Safe gtag event reporter
export function reportError(description: string, fatal: boolean = false): void {
  if (hasGtag()) {
    window.gtag!('event', 'exception', {
      description,
      fatal,
    });
  }
}

export {}; // Make this a module 