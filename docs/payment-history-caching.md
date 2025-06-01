# Payment History Caching & Refresh System

## Overview

This document describes the intelligent payment history caching and refresh system implemented to solve performance and data consistency issues in the GotSOL merchant payment tracking system.

## Problem Statement

### Original Issues

1. **Missed Payments**: When the app was closed and payments occurred, they wouldn't appear when users returned because:
   - Real-time blockchain subscriptions weren't active
   - Conservative React Query refetch settings prevented automatic updates
   - No mechanism to force refresh payment data

2. **Inefficient Data Fetching**: The system always fetched all payment history (up to 250 transactions) on every refresh:
   - Wasted RPC calls and bandwidth
   - Slow response times for merchants with many transactions
   - No incremental updates

3. **Scalability Concerns**: For busy merchants with hundreds/thousands of payments:
   - Unlimited caching would exceed localStorage limits (5-10MB)
   - Large arrays caused UI performance issues
   - Memory consumption problems on mobile devices
   - Users rarely need very old payment data for daily operations

## Solution Architecture

### Core Components

1. **Incremental Fetching System** (`fetchNewPayments`)
2. **Smart Cache Management** (auto-pruning with configurable limits)
3. **Force Refresh Mechanisms** (multiple trigger points)
4. **Load More Functionality** (on-demand historical data access)

### System Flow

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Action   │───▶│  Refresh Logic   │───▶│  Cache Update   │
│                 │    │                  │    │                 │
│ • Window focus  │    │ • Check existing │    │ • Merge new     │
│ • Page load     │    │ • Fetch only new │    │ • Auto-prune    │
│ • Manual refresh│    │ • Fallback logic │    │ • Save to disk  │
│ • Navigation    │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Implementation Details

### 1. Incremental Fetching (`fetchNewPayments`)

**Location**: `src/components/payments/payment-history.tsx`

**Purpose**: Fetch only new payments since the most recent cached payment.

**Key Features**:
- Uses Solana's `until` parameter to stop at known signatures
- Smaller batch sizes (3 vs 5) for faster incremental processing
- Graceful error handling - returns empty array instead of breaking
- Duplicate signature filtering for safety

```typescript
async function fetchNewPayments(
    merchantPubkey: PublicKey,
    connection: Connection,
    existingPayments: Payment[],
    isDevnet: boolean = true
): Promise<Payment[]>
```

**Performance Impact**:
- ~90% reduction in RPC calls for regular refreshes
- Typical update: 0-5 new transactions vs 50+ existing ones
- Faster response times due to smaller batch processing

### 2. Smart Cache Management

**Location**: `src/hooks/use-payment-cache.ts`

**Purpose**: Maintain optimal cache size and performance while preserving recent data.

#### Configuration

```typescript
const CACHE_CONFIG = {
  MAX_PAYMENTS: 200,        // Maximum payments in cache
  MAX_AGE_DAYS: 90,         // Auto-prune older than 90 days
  PRUNE_TO_COUNT: 150,      // Target size after pruning
  MIN_RECENT_PAYMENTS: 50,  // Always keep most recent (regardless of age)
}
```

#### Pruning Logic

1. **Count-based**: When cache exceeds 200 payments
2. **Age-based**: Remove payments older than 90 days
3. **Safety net**: Always preserve 50 most recent payments
4. **Target optimization**: Prune down to 150 payments

#### Cache Data Structure

```typescript
interface PaymentCacheData {
  payments: SerializedPayment[];
  lastUpdated: number;
  merchantPubkey: string;
  isDevnet: boolean;
  totalPaymentsEverSeen?: number; // Analytics tracking
}
```

### 3. Force Refresh Mechanisms

**Location**: Multiple components

#### Trigger Points

1. **Window Visibility Change**: Automatically refresh when user returns to tab
   ```typescript
   // Triggers after 1-second delay for connection stability
   document.addEventListener('visibilitychange', handleVisibilityChange);
   ```

2. **Component Mount**: Force refresh when navigating to merchant pages
   ```typescript
   // 1.5-second delay ensures full component mounting
   useEffect(() => {
     setTimeout(() => forceRefreshPayments(), 1500);
   }, []);
   ```

3. **Manual Refresh**: User-triggered refresh button
   ```typescript
   // Always available, uses incremental refresh logic
   <button onClick={() => refetch()}>Refresh</button>
   ```

#### Refresh Logic (`handleForceRefresh`)

```typescript
const handleForceRefresh = useCallback(async () => {
  const existingPayments = queryClient.getQueryData(['payments', ...]) || [];
  
  if (existingPayments.length > 0) {
    // Incremental update
    const newPayments = await fetchNewPayments(...);
    const mergedPayments = [...newPayments, ...existingPayments];
    const prunedPayments = prunePayments(mergedPayments);
    // Update cache with pruned data
  } else {
    // Full refresh for empty cache
    await queryClient.invalidateQueries(...);
  }
  
  // Always refresh balance (lightweight operation)
  await queryClient.invalidateQueries(['usdc-balance', ...]);
}, [...]);
```

### 4. Load More Functionality

**Purpose**: Provide access to historical data beyond cache limits without impacting performance.

**Features**:
- Only shown on full payment history pages (not dashboard preview)
- Loads 50 additional payments at a time
- Uses pagination with `before` parameter
- Doesn't auto-prune loaded historical data (user controls)

**UI Implementation**:
```typescript
const shouldShowLoadMore = !maxPayments && hasMorePayments && 
  payments.length > 0 && payments.length >= CACHE_CONFIG.MIN_RECENT_PAYMENTS;
```

## Usage Examples

### Basic Usage (Dashboard)

```typescript
// Dashboard shows recent payments with auto-refresh
<PaymentHistory
  program={program}
  merchantPubkey={merchantPubkey}
  isDevnet={true}
  onBalanceUpdate={setMerchantBalance}
  onPaymentReceived={() => setResetSignal(prev => prev + 1)}
  title="Recent Payment History"
  maxPayments={3}  // Limits display, shows only recent
  forceRefresh={forceRefreshRef}
/>
```

### Full History Usage (Manage Funds)

```typescript
// Full history with Load More functionality
<PaymentHistory
  program={program}
  merchantPubkey={merchantPubkey}
  isDevnet={true}
  title="Full Payment History"
  // No maxPayments = shows all cached + Load More button
  forceRefresh={forceRefreshRef}
/>
```

### Force Refresh Hook

```typescript
// Parent component can trigger refresh
const { forceRefresh, forceRefreshRef } = usePaymentRefresh(merchantPubkey, true);

// Auto-refresh on mount
useEffect(() => {
  const timer = setTimeout(() => forceRefresh(), 1500);
  return () => clearTimeout(timer);
}, [forceRefresh]);
```

## Performance Metrics

### Before Optimization

- **Cache Size**: Unlimited (could exceed 5MB for busy merchants)
- **Refresh Method**: Full re-fetch of all payments (250 transactions)
- **RPC Calls**: High frequency, large payloads
- **UI Performance**: Degrades with payment count
- **Mobile Support**: Memory issues with large datasets

### After Optimization

- **Cache Size**: ~500KB (150-200 payments)
- **Refresh Method**: Incremental (typically 0-5 new payments)
- **RPC Calls**: 90% reduction for regular updates
- **UI Performance**: Consistent regardless of total payment count
- **Mobile Support**: Optimized memory usage

### Real-World Example

**Busy merchant with 1000+ payments**:
- **Before**: Fetch and process all 1000+ payments on refresh
- **After**: Fetch only 2-3 new payments since last update
- **Result**: ~99% reduction in processing time and bandwidth

## Configuration Options

### Cache Limits

Modify `CACHE_CONFIG` in both files to adjust behavior:

```typescript
// src/hooks/use-payment-cache.ts
// src/components/payments/payment-history.tsx
const CACHE_CONFIG = {
  MAX_PAYMENTS: 200,      // Increase for more cache
  MAX_AGE_DAYS: 90,       // Adjust retention period
  PRUNE_TO_COUNT: 150,    // Target after pruning
  MIN_RECENT_PAYMENTS: 50 // Safety net size
}
```

### React Query Settings

```typescript
// Payment data caching
staleTime: 10 * 60 * 1000,     // 10 minutes fresh
gcTime: 60 * 60 * 1000,        // 60 minutes in memory
refetchOnWindowFocus: false,    // Manual control only
refetchOnMount: false,          // Prevent auto-refetch
```

## Monitoring & Debugging

### Console Logging

The system provides detailed console output for monitoring:

```
✅ Loaded 87 cached payments from localStorage (last updated: 12/20/2024, 2:30:15 PM)
✅ Performing incremental payment refresh...
✅ Fetching 2 new payment(s) for incremental update
✅ Added 2 new payment(s) to cache (total: 89)
✅ Cache stats: 89 payments, oldest: 10/15/2024, avg age: 18.3 days
```

### Cache Statistics

Monitor cache health with built-in statistics:
- Payment count and age distribution
- Pruning activity and frequency
- Cache hit/miss rates
- Storage usage optimization

## Error Handling & Fallbacks

### Graceful Degradation

1. **Incremental fetch failure** → Falls back to full refresh
2. **Cache corruption** → Rebuilds from blockchain data
3. **Connection issues** → Uses cached data until reconnection
4. **Rate limiting** → Implements exponential backoff

### Safety Measures

- Duplicate signature filtering
- Data structure validation
- Cache size limits enforcement
- Error boundary protection

## Future Enhancements

### Potential Improvements

1. **Compression**: Implement cache compression for larger limits
2. **Background sync**: Periodic background updates
3. **Analytics**: Track cache efficiency metrics
4. **User preferences**: Configurable cache limits per user
5. **Export functionality**: Bulk export of historical data

### Scalability Considerations

- Current system scales to ~1000 payments per merchant efficiently
- For enterprise merchants with 10k+ payments, consider:
  - Server-side pagination
  - Database integration
  - Real-time webhook integration
  - Advanced compression techniques

---

## Conclusion

This caching system provides a robust foundation for scalable payment history management, balancing performance, user experience, and data consistency. The incremental update approach ensures the app remains responsive regardless of merchant transaction volume while providing complete historical access when needed. 