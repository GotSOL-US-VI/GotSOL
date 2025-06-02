/**
 * Enhanced Logging Utility
 * 
 * This utility provides centralized control over detailed component and hook logging.
 * Use this to enable/disable logging across the entire application.
 */

// Global configuration for enhanced logging
export const LOGGING_CONFIG = {
  // Master switch - set to false to disable all enhanced logging
  ENABLED: true,
  
  // Individual component logging controls
  PAYMENT_CACHE: true,
  MERCHANT_FINDER: true,
  PAYMENT_HISTORY: true,
  CLIENT_PROVIDERS: true,
  
  // Log level controls
  SHOW_STACK_TRACES: true,
  SHOW_TIMESTAMPS: true,
  SHOW_DETAILS: true,
};

/**
 * Enhanced logger factory
 * Creates a logger function for a specific component with consistent formatting
 */
export function createEnhancedLogger(
  componentName: string, 
  color: string,
  enabled: boolean = true
) {
  return function logComponentCall(
    operation: string, 
    details?: any, 
    line?: string,
    forceLog: boolean = false
  ) {
    // Skip logging if disabled (unless forced)
    if (!LOGGING_CONFIG.ENABLED || (!enabled && !forceLog)) {
      return;
    }
    
    const error = new Error();
    const stack = error.stack?.split('\n');
    
    // Find the calling component in the stack trace
    let callingComponent = componentName;
    let callingLine = line || 'Unknown';
    
    if (!line && stack && LOGGING_CONFIG.SHOW_STACK_TRACES) {
      for (let i = 1; i < stack.length; i++) {
        const stackLine = stack[i];
        if (stackLine.includes('.tsx') || stackLine.includes('.ts')) {
          const match = stackLine.match(/\/([^\/]+\.(tsx?|jsx?)):(\d+):\d+/);
          if (match) {
            callingComponent = match[1];
            callingLine = match[3];
            break;
          }
        }
      }
    }
    
    const timestamp = LOGGING_CONFIG.SHOW_TIMESTAMPS ? 
      `[${new Date().toISOString()}] ` : '';
    
    const detailsText = (LOGGING_CONFIG.SHOW_DETAILS && details) ? 
      `\n  📊 Details: ${JSON.stringify(details, null, 2)}` : '';
    
    console.log(
      `%c${timestamp}${componentName.toUpperCase()}: ${operation}`,
      `color: ${color}; font-weight: bold;`,
      `\n  📍 Component: ${callingComponent}:${callingLine}`,
      `\n  🔧 Hook/Function: ${componentName}${detailsText}`
    );
  };
}

/**
 * Pre-configured loggers for each component
 */
export const loggers = {
  paymentCache: createEnhancedLogger('PAYMENT CACHE', '#00ff88', LOGGING_CONFIG.PAYMENT_CACHE),
  merchantFinder: createEnhancedLogger('MERCHANT FINDER', '#ff6b35', LOGGING_CONFIG.MERCHANT_FINDER),
  paymentHistory: createEnhancedLogger('PAYMENT HISTORY', '#4285f4', LOGGING_CONFIG.PAYMENT_HISTORY),
  clientProviders: createEnhancedLogger('CLIENT PROVIDERS', '#9c27b0', LOGGING_CONFIG.CLIENT_PROVIDERS),
};

/**
 * Quick toggle functions for debugging
 */
export const loggingControls = {
  enableAll: () => {
    Object.assign(LOGGING_CONFIG, {
      ENABLED: true,
      PAYMENT_CACHE: true,
      MERCHANT_FINDER: true,
      PAYMENT_HISTORY: true,
      CLIENT_PROVIDERS: true,
    });
    console.log('%cAll enhanced logging enabled', 'color: #00ff00; font-weight: bold;');
  },
  
  disableAll: () => {
    Object.assign(LOGGING_CONFIG, {
      ENABLED: false,
      PAYMENT_CACHE: false,
      MERCHANT_FINDER: false,
      PAYMENT_HISTORY: false,
      CLIENT_PROVIDERS: false,
    });
    console.log('%cAll enhanced logging disabled', 'color: #ff0000; font-weight: bold;');
  },
  
  enablePaymentLogging: () => {
    LOGGING_CONFIG.PAYMENT_CACHE = true;
    LOGGING_CONFIG.PAYMENT_HISTORY = true;
    console.log('%cPayment logging enabled', 'color: #00ff88; font-weight: bold;');
  },
  
  enableMerchantLogging: () => {
    LOGGING_CONFIG.MERCHANT_FINDER = true;
    LOGGING_CONFIG.CLIENT_PROVIDERS = true;
    console.log('%cMerchant logging enabled', 'color: #ff6b35; font-weight: bold;');
  },
  
  showStatus: () => {
    console.group('%cEnhanced Logging Status', 'color: #4285f4; font-weight: bold;');
    console.log('Master enabled:', LOGGING_CONFIG.ENABLED);
    console.log('Payment Cache:', LOGGING_CONFIG.PAYMENT_CACHE);
    console.log('Merchant Finder:', LOGGING_CONFIG.MERCHANT_FINDER);
    console.log('Payment History:', LOGGING_CONFIG.PAYMENT_HISTORY);
    console.log('Client Providers:', LOGGING_CONFIG.CLIENT_PROVIDERS);
    console.log('Show Stack Traces:', LOGGING_CONFIG.SHOW_STACK_TRACES);
    console.log('Show Timestamps:', LOGGING_CONFIG.SHOW_TIMESTAMPS);
    console.log('Show Details:', LOGGING_CONFIG.SHOW_DETAILS);
    console.groupEnd();
  }
};

/**
 * Performance logging utilities
 */
export class PerformanceLogger {
  private startTimes: Map<string, number> = new Map();
  private logger: ReturnType<typeof createEnhancedLogger>;
  
  constructor(componentName: string, color: string) {
    this.logger = createEnhancedLogger(`${componentName} PERF`, color);
  }
  
  start(operation: string) {
    this.startTimes.set(operation, performance.now());
    this.logger(`Started: ${operation}`);
  }
  
  end(operation: string, details?: any) {
    const startTime = this.startTimes.get(operation);
    if (startTime) {
      const duration = performance.now() - startTime;
      this.logger(`Completed: ${operation}`, {
        duration: `${duration.toFixed(2)}ms`,
        ...details
      });
      this.startTimes.delete(operation);
    } else {
      this.logger(`Warning: No start time found for ${operation}`);
    }
  }
}

/**
 * Call flow tracking utilities
 */
export class CallFlowTracker {
  private static callStack: string[] = [];
  private static maxStackSize = 10;
  
  static push(componentName: string, operation: string) {
    const entry = `${componentName}.${operation}`;
    this.callStack.push(entry);
    
    // Prevent stack overflow
    if (this.callStack.length > this.maxStackSize) {
      this.callStack.shift();
    }
    
    console.log(
      `%c📞 CALL FLOW: ${entry}`,
      'color: #ff9800; font-size: 10px;',
      `\n  Stack: ${this.callStack.join(' → ')}`
    );
  }
  
  static pop() {
    this.callStack.pop();
  }
  
  static getStack(): string[] {
    return [...this.callStack];
  }
  
  static clear() {
    this.callStack = [];
    console.log('%c📞 CALL FLOW: Stack cleared', 'color: #ff9800;');
  }
}

// Make logging controls available globally for easy debugging
if (typeof window !== 'undefined') {
  (window as any).enhancedLogging = loggingControls;
  (window as any).callFlow = CallFlowTracker;
  
  console.log(
    '%cEnhanced Logging Initialized! 🎯', 
    'color: #4CAF50; font-weight: bold; font-size: 16px;'
  );
  console.log(
    '%cUse window.enhancedLogging to control logging or window.callFlow to track calls',
    'color: #2196F3;'
  );
} 