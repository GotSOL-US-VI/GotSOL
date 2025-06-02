# Enhanced Logging System Guide 🎯

This guide explains the comprehensive logging system that has been added to track component calls, hook usage, and API operations throughout the application.

## 🚀 Quick Start

The enhanced logging system is **enabled by default** and will automatically provide detailed information about:

- Which component is making calls
- What line number the call originates from
- Hook and function names being executed
- Detailed operation parameters and results
- Performance metrics and timing information

## 📊 Log Categories

The system provides color-coded logging for different areas:

| Category | Color | Description |
|----------|-------|-------------|
| 🟢 **PAYMENT CACHE** | Green (#00ff88) | LocalStorage operations, cache hits/misses, payment data persistence |
| 🟠 **MERCHANT FINDER** | Orange (#ff6b35) | RPC calls to fetch merchant accounts, cache operations, merchant state changes |
| 🔵 **PAYMENT HISTORY** | Blue (#4285f4) | React Query operations, payment fetching, balance updates, real-time subscriptions |
| 🟣 **CLIENT PROVIDERS** | Purple (#9c27b0) | Navigation changes, merchant state transitions, theme changes |

## 🎮 Console Controls

### Global Access
The logging system exposes global controls via the browser console:

```javascript
// Check current logging status
window.enhancedLogging.showStatus()

// Enable all logging
window.enhancedLogging.enableAll()

// Disable all logging
window.enhancedLogging.disableAll()

// Enable only payment-related logging
window.enhancedLogging.enablePaymentLogging()

// Enable only merchant-related logging
window.enhancedLogging.enableMerchantLogging()
```

### Call Flow Tracking
Track the sequence of function calls:

```javascript
// View current call stack
window.callFlow.getStack()

// Clear call flow history
window.callFlow.clear()
```

## 📝 Log Output Examples

### Payment Cache Operations
```
[2024-01-15T10:30:45.123Z] PAYMENT CACHE: Loading from localStorage
  📍 Component: PaymentHistory.tsx:125
  🔧 Hook: usePaymentCache
  📊 Details: {
    "cacheKey": "payments-ABC123...-devnet",
    "merchantPubkey": "ABC123..."
  }
```

### Merchant Finding Operations
```
[2024-01-15T10:30:45.456Z] MERCHANT FINDER: RPC fetch completed
  📍 Component: DashboardContent.tsx:67
  🔧 Hook: find-merchants
  📊 Details: {
    "totalAccountsFound": 3,
    "newAccountsFound": 1,
    "merchantNames": ["Coffee Shop", "Bookstore"]
  }
```

### Payment History React Query
```
[2024-01-15T10:30:45.789Z] PAYMENT HISTORY: React Query fetchPaymentData triggered
  📍 Component: PaymentHistory.tsx:201
  🔧 Hook/Function: payment-history.tsx
  📊 Details: {
    "merchantPubkey": "ABC123...",
    "isDevnet": true,
    "refundInProgress": false
  }
```

## 🔧 Configuration

### File-based Configuration
Edit `src/utils/enhanced-logging.ts` to customize logging behavior:

```typescript
export const LOGGING_CONFIG = {
  // Master switch
  ENABLED: true,
  
  // Individual components
  PAYMENT_CACHE: true,
  MERCHANT_FINDER: true,
  PAYMENT_HISTORY: true,
  CLIENT_PROVIDERS: true,
  
  // Display options
  SHOW_STACK_TRACES: true,
  SHOW_TIMESTAMPS: true,
  SHOW_DETAILS: true,
};
```

### Runtime Configuration
Use console commands to adjust logging on the fly:

```javascript
// Disable timestamps for cleaner output
LOGGING_CONFIG.SHOW_TIMESTAMPS = false

// Hide detailed information
LOGGING_CONFIG.SHOW_DETAILS = false

// Disable stack trace parsing (faster performance)
LOGGING_CONFIG.SHOW_STACK_TRACES = false
```

## 🕵️ Debugging Workflows

### 1. Payment Issues
```javascript
// Enable only payment logging
window.enhancedLogging.disableAll()
window.enhancedLogging.enablePaymentLogging()

// Trigger a payment refresh and watch the logs
// Navigate to a merchant page or click refresh button
```

### 2. Merchant Loading Issues
```javascript
// Enable only merchant logging
window.enhancedLogging.disableAll()
window.enhancedLogging.enableMerchantLogging()

// Navigate between merchants or refresh the page
```

### 3. Performance Investigation
```javascript
// Enable all logging and check timing
window.enhancedLogging.enableAll()

// Look for logs with performance data:
// - Cache hit/miss ratios
// - RPC call frequencies
// - React Query refetch patterns
```

### 4. Component Call Flow
```javascript
// Track the sequence of operations
window.callFlow.clear()
// Perform the action you want to debug
window.callFlow.getStack()
```

## 📈 Performance Monitoring

The logging system includes built-in performance tracking:

### Automatic Timing
- **Cache Operations**: Time spent loading/saving to localStorage
- **RPC Calls**: Duration of blockchain API calls
- **React Query**: Query execution times and cache operations

### Performance Logs Example
```
[2024-01-15T10:30:45.999Z] MERCHANT FINDER PERF: Completed: fetchMerchantData
  📍 Component: find-merchants.ts:245
  🔧 Hook/Function: MERCHANT FINDER PERF
  📊 Details: {
    "duration": "1247.50ms",
    "merchantsFound": 3,
    "cacheHit": false
  }
```

## 🎯 Key Monitoring Points

### Payment Cache Hook (`usePaymentCache`)
- **Hook Initialized**: Component mounting with cache parameters
- **Loading from localStorage**: Cache retrieval attempts
- **Cache Loaded Successfully**: Successful cache hits with payment counts
- **Saving to localStorage**: Cache write operations with pruning details
- **Force Refresh Starting**: Manual refresh operations

### Merchant Finder Hook (`find-merchants`)
- **useMerchants Hook Initialized**: Hook setup with wallet connection
- **React Query fetchMerchantData triggered**: Automatic query execution
- **Performing full/incremental refresh**: Different refresh strategies
- **RPC fetch completed**: Blockchain query results
- **Cached merchants loaded**: LocalStorage cache usage

### Payment History Component
- **Component Initialized**: Component mounting with configuration
- **React Query fetchPaymentData triggered**: Payment data queries
- **fetchBalance started/completed**: Balance checking operations
- **Force refresh started**: Manual refresh operations
- **Incremental refresh**: Smart cache updating

### Client Providers
- **ClientSideStateHandler Initialized**: App state initialization
- **Route change detected**: Navigation events
- **Setting active merchant from route**: Merchant state changes
- **Logo clicked**: Navigation to home with state cleanup

## 🛠️ Troubleshooting

### Common Issues

1. **Too much logging output**
   ```javascript
   // Disable details to reduce noise
   LOGGING_CONFIG.SHOW_DETAILS = false
   ```

2. **Performance impact from logging**
   ```javascript
   // Disable stack traces for better performance
   LOGGING_CONFIG.SHOW_STACK_TRACES = false
   ```

3. **Missing logs for specific operations**
   ```javascript
   // Check if the component logging is enabled
   window.enhancedLogging.showStatus()
   ```

### Log Filtering in Browser
Use browser console filtering to focus on specific operations:

- Filter by `PAYMENT CACHE` to see only cache operations
- Filter by `MERCHANT FINDER` to see only merchant-related calls
- Filter by `React Query` to see only query operations
- Filter by `Force refresh` to see only manual refresh operations

## 🎨 Customization

### Adding New Component Logging
To add logging to a new component:

1. Import the logger utility:
   ```typescript
   import { createEnhancedLogger } from '@/utils/enhanced-logging';
   ```

2. Create a component-specific logger:
   ```typescript
   const logMyComponent = createEnhancedLogger('MY COMPONENT', '#ff5722');
   ```

3. Add logging calls:
   ```typescript
   logMyComponent('Operation started', { parameter: value });
   ```

### Custom Log Categories
Add new categories to `LOGGING_CONFIG` in `enhanced-logging.ts`:

```typescript
export const LOGGING_CONFIG = {
  // ... existing config
  MY_NEW_COMPONENT: true,
};
```

## 📚 Integration Points

The enhanced logging integrates with these key files:

- **`src/hooks/use-payment-cache.ts`**: Payment caching operations
- **`src/hooks/find-merchants.ts`**: Merchant discovery and management
- **`src/components/payments/payment-history.tsx`**: Payment data display and management
- **`src/components/providers/client-providers.tsx`**: Application state and navigation
- **`src/utils/enhanced-logging.ts`**: Central logging configuration and utilities

## 🚀 Production Considerations

### Disabling in Production
To disable logging in production, set the master switch:

```typescript
export const LOGGING_CONFIG = {
  ENABLED: process.env.NODE_ENV !== 'production',
  // ... rest of config
};
```

### Performance Impact
The logging system is designed to have minimal performance impact:
- Logs are only generated when enabled
- Stack trace parsing is optional
- JSON serialization is lazy (only when details are shown)
- No persistent storage of logs

---

**Happy Debugging! 🐛✨**

Use this enhanced logging system to quickly identify which components are making calls, trace the flow of operations, and diagnose issues in your payment and merchant management system. 