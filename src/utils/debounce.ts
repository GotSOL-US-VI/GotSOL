/**
 * Debounce Utilities
 * 
 * These utilities help prevent excessive function calls, especially for:
 * - API requests
 * - Search operations  
 * - Expensive computations
 * - User input handlers
 */

/**
 * Standard debounce function
 * Delays execution until after the specified delay has passed since the last invocation
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Throttle function  
 * Limits function execution to at most once per specified interval
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  interval: number
): (...args: Parameters<T>) => void {
  let lastCallTime = 0;
  let timeoutId: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;
    
    if (timeSinceLastCall >= interval) {
      // Execute immediately if enough time has passed
      lastCallTime = now;
      func(...args);
    } else if (!timeoutId) {
      // Schedule execution for the remaining time
      timeoutId = setTimeout(() => {
        lastCallTime = Date.now();
        timeoutId = null;
        func(...args);
      }, interval - timeSinceLastCall);
    }
  };
}

/**
 * Advanced debounce with leading edge option
 * Can execute immediately on first call, then debounce subsequent calls
 */
export function advancedDebounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number,
  options: {
    leading?: boolean;
    trailing?: boolean;
    maxWait?: number;
  } = {}
): (...args: Parameters<T>) => void {
  const { leading = false, trailing = true, maxWait } = options;
  
  let timeoutId: NodeJS.Timeout | null = null;
  let maxTimeoutId: NodeJS.Timeout | null = null;
  let lastCallTime = 0;
  let lastInvokeTime = 0;
  
  const invokeFunc = (...args: Parameters<T>) => {
    lastInvokeTime = Date.now();
    return func(...args);
  };
  
  const leadingEdge = (...args: Parameters<T>) => {
    lastInvokeTime = Date.now();
    timeoutId = setTimeout(() => trailingEdge(...args), delay);
    return leading ? invokeFunc(...args) : undefined;
  };
  
  const trailingEdge = (...args: Parameters<T>) => {
    timeoutId = null;
    if (trailing && lastCallTime !== lastInvokeTime) {
      return invokeFunc(...args);
    }
    return undefined;
  };
  
  const timerExpired = (...args: Parameters<T>) => {
    const timeSinceLastCall = Date.now() - lastCallTime;
    if (timeSinceLastCall < delay) {
      timeoutId = setTimeout(() => timerExpired(...args), delay - timeSinceLastCall);
    } else {
      trailingEdge(...args);
    }
  };
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    const isInvoking = lastCallTime === 0;
    
    lastCallTime = now;
    
    if (isInvoking) {
      return leadingEdge(...args);
    }
    
    if (!timeoutId) {
      timeoutId = setTimeout(() => timerExpired(...args), delay);
    }
    
    if (maxWait && !maxTimeoutId) {
      maxTimeoutId = setTimeout(() => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        maxTimeoutId = null;
        invokeFunc(...args);
      }, maxWait);
    }
  };
}

/**
 * Promise-based debounce for async functions
 * Returns a promise that resolves with the result of the debounced function
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  func: T,
  delay: number
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  let timeoutId: NodeJS.Timeout;
  let resolveList: Array<(value: Awaited<ReturnType<T>>) => void> = [];
  let rejectList: Array<(reason: any) => void> = [];
  
  return (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    return new Promise((resolve, reject) => {
      resolveList.push(resolve);
      rejectList.push(reject);
      
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        const currentResolveList = [...resolveList];
        const currentRejectList = [...rejectList];
        resolveList = [];
        rejectList = [];
        
        try {
          const result = await func(...args);
          currentResolveList.forEach(resolve => resolve(result));
        } catch (error) {
          currentRejectList.forEach(reject => reject(error));
        }
      }, delay);
    });
  };
}

/**
 * Cache-aware debounce
 * Includes a simple cache to avoid calling the function with the same arguments
 */
export function debouncedCache<T extends (...args: any[]) => any>(
  func: T,
  delay: number,
  cacheSize: number = 10
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  const cache = new Map<string, { result: ReturnType<T>; timestamp: number }>();
  const debouncedFunc = debounce(func, delay);
  
  return (...args: Parameters<T>): ReturnType<T> | undefined => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);
    
    // Return cached result if recent (within delay period)
    if (cached && Date.now() - cached.timestamp < delay) {
      return cached.result;
    }
    
    // Clean up old cache entries
    if (cache.size >= cacheSize) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }
    
    // Execute debounced function
    debouncedFunc(...args);
    
    return undefined; // Will return result after debounce delay
  };
}

/**
 * Specialized debounce for React Query refetch operations
 */
export function debounceRefetch(
  refetchFn: () => Promise<any>,
  delay: number = 1000
) {
  return debounceAsync(refetchFn, delay);
} 