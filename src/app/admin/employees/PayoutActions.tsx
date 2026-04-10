'use client';

import { useState } from 'react';
import { markPayoutAsPaid } from './actions';

type PayoutActionsProps = {
  payoutId: string;
  payout: {
    status: 'pending' | 'paid' | 'cancelled';
  };
};

export default function PayoutActions({ payoutId, payout }: PayoutActionsProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleMarkAsPaid = async () => {
    if (!confirm('Are you sure you want to mark this payout as paid?')) return;
    
    setIsProcessing(true);
    try {
      const result = await markPayoutAsPaid(payoutId, 'Admin');
      if (result.success) {
        window.location.reload();
      } else {
        alert(result.error || 'Failed to mark payout as paid');
      }
    } catch (error) {
      alert('An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  if (payout.status === 'paid') {
    return (
      <span className="text-xs text-emerald-600">Paid</span>
    );
  }

  if (payout.status === 'cancelled') {
    return (
      <span className="text-xs text-gray-500">Cancelled</span>
    );
  }

  return (
    <button
      onClick={handleMarkAsPaid}
      disabled={isProcessing}
      className="inline-flex items-center rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
    >
      {isProcessing ? 'Processing...' : 'Mark Paid'}
    </button>
  );
}
