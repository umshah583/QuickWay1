'use client';

import { useState } from 'react';
import { calculateMonthlyPayouts } from './actions';

export default function PayoutForm() {
  const [month, setMonth] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [workingDays, setWorkingDays] = useState('26');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setIsSubmitting(true);

    try {
      const yearNum = Number.parseInt(year, 10);
      if (Number.isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
        setError('Please enter a valid year');
        return;
      }

      if (!month) {
        setError('Please select a month');
        return;
      }

      const workingDaysNum = Number.parseInt(workingDays, 10);
      if (Number.isNaN(workingDaysNum) || workingDaysNum < 1 || workingDaysNum > 31) {
        setError('Please enter valid working days (1-31)');
        return;
      }

      const result = await calculateMonthlyPayouts(month, yearNum, workingDaysNum);

      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || 'Failed to calculate payouts');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const months = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  return (
    <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-5 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-[var(--text-strong)]">Calculate Monthly Payouts</h3>
      
      {success && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-600">
          Payouts calculated successfully!
        </div>
      )}
      
      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-600">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex flex-col text-sm text-[var(--text-muted)]">
          <span className="font-semibold text-[var(--text-strong)]">Month</span>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-1 h-10 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            required
          >
            <option value="">Select month...</option>
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        
        <label className="flex flex-col text-sm text-[var(--text-muted)]">
          <span className="font-semibold text-[var(--text-strong)]">Year</span>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="e.g., 2026"
            className="mt-1 h-10 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            required
          />
        </label>
        
        <label className="flex flex-col text-sm text-[var(--text-muted)]">
          <span className="font-semibold text-[var(--text-strong)]">Working Days</span>
          <input
            type="number"
            value={workingDays}
            onChange={(e) => setWorkingDays(e.target.value)}
            placeholder="e.g., 26"
            min="1"
            max="31"
            className="mt-1 h-10 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            required
          />
          <span className="mt-1 text-xs text-[var(--text-muted)]">Number of working days in the month (default: 26)</span>
        </label>
        
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-secondary)] disabled:opacity-50"
        >
          {isSubmitting ? 'Calculating...' : 'Calculate Payouts'}
        </button>
      </form>
    </div>
  );
}
