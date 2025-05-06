/**
 * Utility to parse Solana program errors into user-friendly messages
 */

interface ParsedError {
  code: string;
  message: string;
}

/**
 * Parses Anchor program errors from error objects returned by Solana transactions
 * 
 * @param error - The error object from a failed Solana transaction
 * @returns An object with a code and message for the error
 */
export function parseAnchorError(error: any): ParsedError {
  // Default error if we can't parse it
  let parsedError: ParsedError = {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred'
  };

  try {
    // First check for common constraint failures in raw logs
    if (error && error.logs) {
      // Check for specific AnchorError for InsufficientFunds
      if (error.logs.some((log: string) => 
          log.includes('AnchorError') && 
          log.includes('merchant_usdc_ata') && 
          log.includes('InsufficientFunds'))) {
        return {
          code: 'INSUFFICIENT_FUNDS',
          message: 'The Merchant doesn\'t have enough USDC to complete this refund.'
        };
      }
      
      // Check for insufficient funds in constraint checks
      if (error.logs.some((log: string) => 
        log.includes('Merchant USDC ATA') && 
        log.includes('amount') && 
        log.includes('constraint was violated'))) {
        return {
          code: 'INSUFFICIENT_FUNDS',
          message: 'Insufficient funds for this operation. The Merchant account doesn\'t have enough USDC.'
        };
      }
      
      // Then look for "account already in use" in simulation logs
      // But only if we didn't already identify it as an insufficient funds error
      const alreadyInUseLogs = error.logs.filter((log: string) => 
        log.includes('already in use')
      );
      
      if (alreadyInUseLogs.length > 0) {
        // Check if it's related to a refund
        if (error.logs.some((log: string) => log.includes('Instruction: Refund'))) {
          return {
            code: 'REFUND_ALREADY_PROCESSED',
            message: 'This refund has already been processed. This program prevents double refunds.'
          };
        }
      }
      
      // Check for program error patterns in logs
      const errorLogs = error.logs.filter((log: string) => 
        log.includes('Program log: Error:') || 
        log.includes('Program log: Anchor Error')
      );

      if (errorLogs.length > 0) {
        // Try to extract error details from logs
        const errorLog = errorLogs[0];
        
        // Check for specific error types
        if (errorLog.includes('InsufficientFunds')) {
          return {
            code: 'INSUFFICIENT_FUNDS',
            message: 'The Merchant doesn\'t have enough USDC to complete this refund.'
          };
        } else if (errorLog.includes('NotMerchantOwner')) {
          return {
            code: 'NOT_MERCHANT_OWNER',
            message: 'Only the Merchant\' Owner can perform this action.'
          };
        } else if (errorLog.includes('ZeroAmountWithdrawal')) {
          return {
            code: 'ZERO_AMOUNT',
            message: 'Amount must be greater than zero.'
          };
        } else if (errorLog.includes('ExceedsRefundLimit')) {
          return {
            code: 'EXCEEDS_REFUND_LIMIT',
            message: 'This amount exceeds the Merchant\'s refund limit.'
          };
        } else if (errorLog.includes('InvalidMerchantName')) {
          return {
            code: 'INVALID_MERCHANT_NAME',
            message: 'Merchant name cannot be empty.'
          };
        } else if (errorLog.includes('UnauthorizedStatusChange')) {
          return {
            code: 'UNAUTHORIZED_STATUS_CHANGE',
            message: 'Only the platform admin can change a Merchant\'s status.'
          };
        }
        
        // If there's an error message but we don't recognize it specifically
        return {
          code: 'PROGRAM_ERROR',
          message: `Program error: ${errorLog.split('Error:').pop()?.trim() || 'Unknown error'}`
        };
      }
    }
    
    // Check for simulation failure messages
    if (error && error.message) {
      // Check for insufficient funds in error message
      if ((error.message.includes('AnchorError') || error.message.includes('Error Code')) && 
          error.message.includes('InsufficientFunds')) {
        return {
          code: 'INSUFFICIENT_FUNDS',
          message: 'The Merchant doesn\'t have enough USDC to complete this refund.'
        };
      }
      
      // Check for refund already processed in error message
      if ((error.message.includes('AnchorError') || error.message.includes('Error Code')) &&
          error.message.includes('already in use') &&
          error.message.includes('Refund')) {
        return {
          code: 'REFUND_ALREADY_PROCESSED',
          message: 'This refund has already been processed. This program prevents double refunds.'
        };
      }
      
      // Check for insufficient funds indication in simulation error
      if (error.message.includes('Simulation failed') && 
          (error.message.includes('InsufficientFunds') || 
           error.message.includes('insufficient funds') ||
           error.message.includes('amount >= merchant_usdc_ata.amount'))) {
        return {
          code: 'INSUFFICIENT_FUNDS',
          message: 'Insufficient funds for this operation. The Merchant account doesn\'t have enough USDC.'
        };
      }
      
      if (error.message.includes('Simulation failed')) {
        // Only check for "already in use" if it's not an insufficient funds error
        if (error.message.includes('already in use') && error.message.includes('Instruction: Refund')) {
          return {
            code: 'REFUND_ALREADY_PROCESSED',
            message: 'This refund has already been processed. This program prevents double refunds.'
          };
        }
      }
      
      // Check for PDA errors (attempting to reinitialize an account)
      if (error.message.includes('failed to send transaction')) {
        if (error.message.includes('account already in use') || 
            error.message.includes('already exists')) {
          // Check if it's likely a refund record error
          if (error.message.includes('refund')) {
            return {
              code: 'REFUND_ALREADY_PROCESSED',
              message: 'This refund has already been processed. This program prevents double refunds.'
            };
          }
          
          // Otherwise, it's probably a Merchant creation error
          return {
            code: 'ACCOUNT_ALREADY_EXISTS',
            message: 'This account already exists.'
          };
        }
      }
    }
    
    // If we couldn't match any specific pattern but have an error message
    if (error instanceof Error) {
      parsedError.message = error.message;
    }
  } catch (parseError) {
    console.error('Error parsing Anchor error:', parseError);
    // Fall back to default error
  }

  return parsedError;
}

/**
 * Component for displaying a toast error message with optional details
 */
export function ErrorToastContent({ title, message }: { title: string, message: string }) {
  return (
    <div>
      <p>{title}</p>
      <p className="text-xs mt-1">{message}</p>
    </div>
  );
} 