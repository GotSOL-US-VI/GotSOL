# Payment History System - Quick Reference

## 🚀 Quick Start

### Using PaymentHistory Component

```typescript
import { PaymentHistory } from '@/components/payments/payment-history';
import { usePaymentRefresh } from '@/hooks/use-payment-cache';

// Get force refresh capability
const { forceRefresh, forceRefreshRef } = usePaymentRefresh(merchantPubkey, true);

// Use in component
<PaymentHistory
  program={program}
  merchantPubkey={merchantPubkey}
  isDevnet={true}
  title="Payment History"
  maxPayments={10}  // Optional: limit display
  forceRefresh={forceRefreshRef}  // Enable force refresh
  onPaymentReceived={() => {}}    // Callback for new payments
  onBalanceUpdate={(balance) => {}} // Callback for balance changes
/>
```

## 🔧 Key Functions

### Force Refresh Payments

```typescript
// Method 1: Using the hook
const { forceRefresh } = usePaymentRefresh(merchantPubkey, true);
await forceRefresh();

// Method 2: Direct component refresh  
const refetch = useQuery(...).refetch;
await refetch();
```

### Check Cache Status

```typescript
// Get cached payments
const payments = queryClient.getQueryData(['payments', merchantPubkey.toString(), isDevnet]);
console.log(`Cached payments: ${payments?.length || 0}`);

// Check localStorage
const cacheKey = `payments-${merchantPubkey.toString()}-${isDevnet ? 'devnet' : 'mainnet'}`;
const cached = localStorage.getItem(cacheKey);
if (cached) {
  const data = JSON.parse(cached);
  console.log(`Local cache: ${data.payments.length} payments, updated: ${new Date(data.lastUpdated)}`);
}
```

### Manual Cache Pruning

```typescript
// Prune existing cache (if needed)
const { savePaymentsToCache } = usePaymentCache(merchantPubkey, isDevnet);
const currentPayments = queryClient.getQueryData(['payments', ...]);
savePaymentsToCache(currentPayments); // Will auto-prune
```

## ⚙️ Configuration

### Cache Limits

```typescript
// Modify in both files:
// src/hooks/use-payment-cache.ts
// src/components/payments/payment-history.tsx

const CACHE_CONFIG = {
  MAX_PAYMENTS: 200,        // Total cache limit
  MAX_AGE_DAYS: 90,         // Age-based pruning  
  PRUNE_TO_COUNT: 150,      // Target after pruning
  MIN_RECENT_PAYMENTS: 50,  // Always keep recent
}
```

### React Query Settings

```typescript
// In PaymentHistory component
const { data: payments } = useQuery({
  queryKey: ['payments', merchantPubkey.toString(), isDevnet],
  staleTime: 10 * 60 * 1000,      // 10 min fresh
  gcTime: 60 * 60 * 1000,         // 60 min in memory
  refetchOnWindowFocus: false,     // Manual only
  refetchOnMount: false,           // No auto-refetch
});
```

## 🔍 Debugging

### Console Monitoring

Look for these log messages:

```bash
# Cache loading
✅ Loaded 87 cached payments from localStorage (last updated: 12/20/2024, 2:30:15 PM)

# Incremental updates  
✅ Performing incremental payment refresh...
✅ Fetching 2 new payment(s) for incremental update
✅ Added 2 new payment(s) to cache (total: 89)

# Cache statistics
✅ Cache stats: 89 payments, oldest: 10/15/2024, avg age: 18.3 days

# Pruning activity
⚠️ Pruned 50 old payments from cache (keeping 150 recent payments)
```

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Payments not updating | Cache not refreshing | Check `forceRefreshRef` is passed |
| Old payments missing | Auto-pruning active | Use "Load More" or adjust `CACHE_CONFIG` |
| Slow performance | Cache too large | Reduce `MAX_PAYMENTS` limit |
| Memory issues | No pruning | Ensure `savePaymentsToCache` is called |

## 📊 Monitoring Cache Health

### Check Cache Size

```typescript
// Get cache size in localStorage
function getCacheSize(merchantPubkey: PublicKey, isDevnet: boolean) {
  const cacheKey = `payments-${merchantPubkey.toString()}-${isDevnet ? 'devnet' : 'mainnet'}`;
  const cached = localStorage.getItem(cacheKey);
  return cached ? (new Blob([cached]).size / 1024).toFixed(2) + ' KB' : '0 KB';
}
```

### Performance Metrics

```typescript
// Measure refresh performance
const startTime = performance.now();
await forceRefresh();
const endTime = performance.now();
console.log(`Refresh took ${endTime - startTime} milliseconds`);
```

## 🎯 Best Practices

### Component Usage

```typescript
// ✅ Good: Pass forceRefreshRef for auto-refresh capability
<PaymentHistory 
  forceRefresh={forceRefreshRef}
  maxPayments={5}  // Limit for dashboard views
/>

// ❌ Avoid: Missing forceRefresh means no auto-updates
<PaymentHistory 
  // forceRefresh={forceRefreshRef}  // Missing!
/>
```

### Auto-Refresh Setup

```typescript
// ✅ Good: Auto-refresh on component mount with delay
useEffect(() => {
  const timer = setTimeout(() => forceRefresh(), 1500);
  return () => clearTimeout(timer);
}, [forceRefresh]);

// ❌ Avoid: Immediate refresh can cause race conditions
useEffect(() => {
  forceRefresh(); // Too fast!
}, []);
```

### Error Handling

```typescript
// ✅ Good: Graceful error handling
try {
  await forceRefresh();
} catch (error) {
  console.error('Refresh failed:', error);
  // System will fallback to full refresh automatically
}

// ✅ Good: Check for data before operations
const payments = queryClient.getQueryData(['payments', ...]);
if (payments?.length > 0) {
  // Safe to operate on payments
}
```

## 🚨 Troubleshooting

### Payment Updates Not Showing

1. **Check forceRefresh is connected**:
   ```typescript
   console.log('ForceRefresh available:', !!forceRefreshRef.current);
   ```

2. **Manually trigger refresh**:
   ```typescript
   await forceRefresh();
   ```

3. **Check console for errors**:
   - Look for "Error in incremental refresh" messages
   - Check network connectivity

### Cache Not Persisting

1. **Check localStorage quota**:
   ```javascript
   // Test localStorage availability
   try {
     localStorage.setItem('test', 'test');
     localStorage.removeItem('test');
     console.log('localStorage available');
   } catch (e) {
     console.error('localStorage not available:', e);
   }
   ```

2. **Verify cache key**:
   ```typescript
   const cacheKey = `payments-${merchantPubkey.toString()}-${isDevnet ? 'devnet' : 'mainnet'}`;
   console.log('Cache key:', cacheKey);
   ```

### Performance Issues

1. **Check cache size**:
   ```typescript
   const payments = queryClient.getQueryData(['payments', ...]);
   console.log(`Cache contains ${payments?.length} payments`);
   // Should be < 200 for optimal performance
   ```

2. **Force pruning**:
   ```typescript
   const { savePaymentsToCache } = usePaymentCache(merchantPubkey, isDevnet);
   savePaymentsToCache(payments); // Will auto-prune
   ```

## 📝 Testing

### Manual Testing Scenarios

1. **Incremental Updates**:
   - Send a payment to merchant
   - Trigger refresh
   - Verify only new payment is fetched

2. **Cache Pruning**:
   - Generate 250+ payments
   - Verify cache is pruned to 150
   - Check oldest payments are removed

3. **Load More**:
   - Navigate to full payment history
   - Click "Load More History"
   - Verify older payments load

4. **Auto-Refresh**:
   - Navigate away from app
   - Send payment while away
   - Return to app
   - Verify payment appears

---

## 🔗 Related Files

- `src/components/payments/payment-history.tsx` - Main component
- `src/hooks/use-payment-cache.ts` - Cache management
- `src/app/merchant/dashboard/[merchantId]/DashboardContent.tsx` - Dashboard usage
- `src/app/merchant/dashboard/[merchantId]/manage_funds/ManageFundsContent.tsx` - Full history usage 