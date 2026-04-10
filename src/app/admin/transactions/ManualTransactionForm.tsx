'use client';

import { useState } from 'react';
import { createManualTransaction } from './actions';

export default function ManualTransactionForm() {
  const [type, setType] = useState<'credit' | 'debit'>('credit');
  const [amountCents, setAmountCents] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setIsSubmitting(true);

    try {
      const amount = Number.parseInt(amountCents, 10);
      if (Number.isNaN(amount) || amount <= 0) {
        setError('Amount must be a positive number');
        return;
      }

      const result = await createManualTransaction({
        type,
        amountCents: amount,
        description,
      });

      if (result.success) {
        setSuccess(true);
        setAmountCents('');
        setDescription('');
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || 'Failed to create transaction');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-5 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-[var(--text-strong)]">Manual Transaction</h3>
      
      {success && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-600">
          Transaction created successfully!
        </div>
      )}
      
      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-600">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-4">
          <label className="flex flex-1 flex-col text-sm text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text-strong)]">Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'credit' | 'debit')}
              className="mt-1 h-10 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            >
              <option value="credit">Credit (Income)</option>
              <option value="debit">Debit (Expense)</option>
            </select>
          </label>
          
          <label className="flex flex-1 flex-col text-sm text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text-strong)]">Amount (Cents)</span>
            <input
              type="number"
              value={amountCents}
              onChange={(e) => setAmountCents(e.target.value)}
              placeholder="e.g., 5000 for AED 50.00"
              className="mt-1 h-10 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
              required
            />
          </label>
        </div>
        
        <label className="flex flex-col text-sm text-[var(--text-muted)]">
          <span className="font-semibold text-[var(--text-strong)]">Description</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Refund for booking #12345"
            className="mt-1 h-10 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            required
          />
        </label>
        
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-secondary)] disabled:opacity-50"
        >
          {isSubmitting ? 'Creating...' : 'Create Transaction'}
        </button>
      </form>
    </div>
  );
}
