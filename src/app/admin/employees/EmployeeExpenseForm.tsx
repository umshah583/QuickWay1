'use client';

import { useState } from 'react';
import { createEmployeeExpense } from './actions';

export default function EmployeeExpenseForm({ staff }: { staff: any[] }) {
  const [employeeId, setEmployeeId] = useState('');
  const [type, setType] = useState<'petty_cash' | 'deduction' | 'advance' | 'other'>('deduction');
  const [amountCents, setAmountCents] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Office Supplies');
  const [date, setDate] = useState('');
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

      if (!employeeId) {
        setError('Please select an employee');
        return;
      }

      const result = await createEmployeeExpense({
        employeeId,
        type,
        amountCents: amount,
        description,
        category,
        date: date || new Date().toISOString().split('T')[0],
      });

      if (result.success) {
        setSuccess(true);
        setAmountCents('');
        setDescription('');
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || 'Failed to create expense');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = [
    'Office Supplies',
    'Transportation',
    'Food',
    'Utilities',
    'Miscellaneous',
    'Equipment',
    'Training',
  ];

  return (
    <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-5 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-[var(--text-strong)]">Add Employee Expense</h3>
      
      {success && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-600">
          Expense added successfully!
        </div>
      )}
      
      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-600">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex flex-col text-sm text-[var(--text-muted)]">
          <span className="font-semibold text-[var(--text-strong)]">Employee</span>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="mt-1 h-10 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            required
          >
            <option value="">Select employee...</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.email})
              </option>
            ))}
          </select>
        </label>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col text-sm text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text-strong)]">Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'petty_cash' | 'deduction' | 'advance' | 'other')}
              className="mt-1 h-10 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            >
              <option value="deduction">Deduction</option>
              <option value="petty_cash">Petty Cash</option>
              <option value="advance">Advance</option>
              <option value="other">Other</option>
            </select>
          </label>
          
          <label className="flex flex-col text-sm text-[var(--text-muted)]">
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
        
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col text-sm text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text-strong)]">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 h-10 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </label>
          
          <label className="flex flex-col text-sm text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text-strong)]">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 h-10 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            />
          </label>
        </div>
        
        <label className="flex flex-col text-sm text-[var(--text-muted)]">
          <span className="font-semibold text-[var(--text-strong)]">Description</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Office supplies from stationery store"
            className="mt-1 h-10 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            required
          />
        </label>
        
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-secondary)] disabled:opacity-50"
        >
          {isSubmitting ? 'Adding...' : 'Add Expense'}
        </button>
      </form>
    </div>
  );
}
