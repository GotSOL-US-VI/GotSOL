/**
 * Utility for standardized toast notifications with consistent durations
 * 10 second toast durations
 * This utility component is re-used across all sub-components that use react hot toast
 */
import { ReactNode } from 'react';
import toast, { Toast, ToastOptions } from 'react-hot-toast';

type ToastMessage = string | ReactNode;

// Standard toast duration in milliseconds
export const STANDARD_TOAST_DURATION = 10000; // 10 seconds

// Standard toast options
const standardOptions: ToastOptions = {
  duration: STANDARD_TOAST_DURATION,
  position: 'bottom-right',
};

// Helper functions for consistent toast styling and duration
export const toastUtils = {
  /**
   * Show a success toast with standard duration
   */
  success: (message: ToastMessage, options?: ToastOptions) => {
    return toast.success(message as string, { ...standardOptions, ...options });
  },

  /**
   * Show an error toast with standard duration
   */
  error: (message: ToastMessage, options?: ToastOptions) => {
    return toast.error(message as string, { ...standardOptions, ...options });
  },
  
  /**
   * Show an info toast with standard duration
   */
  info: (message: ToastMessage, options?: ToastOptions) => {
    return toast.success(message as string, { 
      ...standardOptions, 
      ...options,
      icon: '🔔', // Custom icon for info toasts
    });
  },
  
  /**
   * Show a loading toast with standard options
   */
  loading: (message: ToastMessage, options?: ToastOptions) => {
    return toast.loading(message as string, { ...standardOptions, ...options });
  },
  
  /**
   * Dismiss a specific toast or all toasts
   */
  dismiss: (toastId?: string) => {
    if (toastId) {
      toast.dismiss(toastId);
    } else {
      toast.dismiss();
    }
  },
  
  /**
   * Raw toast access (when needed)
   */
  raw: toast
};

/**
 * Legacy hook for transaction toast - now uses standard duration
 */
export function useTransactionToast() {
  return (signature: string, solscanLink?: string) => {
    toastUtils.success(
      <div className="text-center">
        <div className="text-lg">Transaction sent</div>
        {solscanLink ? (
          <a 
            href={solscanLink} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="btn btn-xs btn-primary mt-2"
          >
            View on Solscan
          </a>
        ) : (
          <a 
            href={`https://solscan.io/tx/${signature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-xs btn-primary mt-2"
          >
            View Transaction
          </a>
        )}
      </div>
    );
  };
} 