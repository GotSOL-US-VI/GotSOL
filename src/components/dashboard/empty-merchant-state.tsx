'use client';

export function EmptyMerchantState() {
  return (
    <div className="p-6 bg-base-200 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">If you don&apos;t see your merchant accounts:</h3>
      <ul className="list-disc list-inside space-y-2 text-base-content/80">
        <li>Use the Create Merchant tab above, if you have never made a Merchant with the connected wallet.</li>
        <li>Reload the page to attempt to retrieve any pre-existing Merchant accounts owned by the connected wallet.</li>
        <li>If your connected wallet owns any active Merchant accounts they will show here.</li>
      </ul>
    </div>
  );
} 