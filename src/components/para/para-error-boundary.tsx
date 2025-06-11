import React, { Component, ErrorInfo, ReactNode } from 'react';
import { reportError } from '@/types/global';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ParaErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Para Error Boundary caught an error:', error, errorInfo);
    
    // Report to error tracking service if available
    reportError(`Para Error: ${error.message}`, false);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="alert alert-error">
          <div>
            <h3 className="font-bold">Wallet Connection Error</h3>
            <div className="text-xs">
              {this.state.error?.message || 'An error occurred with the wallet connection'}
            </div>
            <div className="mt-2">
              <button 
                className="btn btn-sm btn-outline"
                onClick={() => {
                  this.setState({ hasError: false, error: undefined });
                  window.location.reload();
                }}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
} 