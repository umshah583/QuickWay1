'use client';

import { useState } from 'react';
import { deleteEmployeeExpense, updateEmployeeExpense, approveExpense, rejectExpense } from './actions';
import { Trash2, Edit2, CheckCircle, XCircle } from 'lucide-react';

type EmployeeExpense = {
  id: string;
  employeeId: string;
  type: 'petty_cash' | 'deduction' | 'advance' | 'other';
  amountCents: number;
  description: string;
  category: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  pettyCashAssignmentId?: string;
};

export default function EmployeeExpenseActions({ expenseId, expense }: { expenseId: string; expense: EmployeeExpense }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this expense?')) {
      return;
    }

    setIsDeleting(true);
    setError('');
    try {
      const result = await deleteEmployeeExpense(expenseId);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      } else {
        setError(result.error || 'Failed to delete expense');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setError('');

    try {
      const amount = Number.parseInt(editAmount, 10);
      if (Number.isNaN(amount) || amount <= 0) {
        setError('Amount must be a positive number');
        return;
      }

      const result = await updateEmployeeExpense(expenseId, {
        amountCents: amount,
        description: editDescription || undefined,
        category: editCategory || undefined,
      });
      if (result.success) {
        setSuccess(true);
        setIsEditing(false);
        setTimeout(() => setSuccess(false), 2000);
      } else {
        setError(result.error || 'Failed to update expense');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleApprove = async () => {
    setIsApproving(true);
    setError('');
    try {
      const result = await approveExpense(expenseId, 'admin');
      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      } else {
        setError(result.error || 'Failed to approve expense');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!confirm('Are you sure you want to reject this expense?')) {
      return;
    }

    setIsApproving(true);
    setError('');
    try {
      const result = await rejectExpense(expenseId);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      } else {
        setError(result.error || 'Failed to reject expense');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setIsApproving(false);
    }
  };

  // Don't show approve/reject for petty cash advances (they're approved via petty cash settlement)
  const isPettyCashAdvance = expense.type === 'advance' && expense.pettyCashAssignmentId;

  return (
    <div className="flex items-center gap-2">
      {success && (
        <span className="text-[10px] text-emerald-600">Success!</span>
      )}
      {error && (
        <span className="text-[10px] text-rose-600">{error}</span>
      )}
      
      {!isPettyCashAdvance && expense.status === 'pending' && (
        <>
          <button
            onClick={handleApprove}
            disabled={isApproving}
            className="p-1.5 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50"
            title="Approve"
          >
            <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
          </button>

          <button
            onClick={handleReject}
            disabled={isApproving}
            className="p-1.5 rounded-lg hover:bg-rose-50 transition-colors disabled:opacity-50"
            title="Reject"
          >
            <XCircle className="h-3.5 w-3.5 text-rose-600" />
          </button>
        </>
      )}

      <button
        onClick={() => setIsEditing(!isEditing)}
        disabled={isUpdating}
        className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50"
        title="Edit"
      >
        <Edit2 className="h-3.5 w-3.5 text-[var(--text-muted)]" />
      </button>

      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="p-1.5 rounded-lg hover:bg-rose-50 transition-colors disabled:opacity-50"
        title="Delete"
      >
        <Trash2 className="h-3.5 w-3.5 text-rose-600" />
      </button>

      {isEditing && (
        <div className="absolute right-0 top-full z-10 mt-2 w-64 rounded-lg border border-[var(--surface-border)] bg-white p-3 shadow-lg">
          <form onSubmit={handleUpdate} className="space-y-2">
            <label className="flex flex-col text-xs text-[var(--text-muted)]">
              <span className="font-semibold">Amount (Cents)</span>
              <input
                type="number"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                placeholder={expense.amountCents.toString()}
                className="mt-1 h-8 rounded border border-[var(--surface-border)] px-2 py-1 text-xs"
                required
              />
            </label>
            <label className="flex flex-col text-xs text-[var(--text-muted)]">
              <span className="font-semibold">Description</span>
              <input
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder={expense.description}
                className="mt-1 h-8 rounded border border-[var(--surface-border)] px-2 py-1 text-xs"
              />
            </label>
            <label className="flex flex-col text-xs text-[var(--text-muted)]">
              <span className="font-semibold">Category</span>
              <input
                type="text"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                placeholder={expense.category}
                className="mt-1 h-8 rounded border border-[var(--surface-border)] px-2 py-1 text-xs"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isUpdating}
                className="flex-1 rounded bg-[var(--brand-primary)] px-2 py-1 text-xs text-white disabled:opacity-50"
              >
                {isUpdating ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 rounded border border-[var(--surface-border)] px-2 py-1 text-xs"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
