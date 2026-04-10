'use client';

import { useState } from 'react';
import { deletePettyCashAssignment, updatePettyCashAssignment } from './actions';
import { Trash2, Edit2, CheckCircle, XCircle } from 'lucide-react';

type PettyCashAssignment = {
  id: string;
  staffId: string;
  staffName: string;
  staffEmail: string;
  amountCents: number;
  assignedAt: string;
  status: 'active' | 'settled';
  receipts: any[];
};

export default function PettyCashActions({ assignmentId, assignment }: { assignmentId: string; assignment: PettyCashAssignment }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this petty cash assignment? This will also remove the corresponding employee expense.')) {
      return;
    }

    setIsDeleting(true);
    setError('');
    try {
      const result = await deletePettyCashAssignment(assignmentId);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      } else {
        setError(result.error || 'Failed to delete assignment');
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

      const result = await updatePettyCashAssignment(assignmentId, { amountCents: amount });
      if (result.success) {
        setSuccess(true);
        setIsEditing(false);
        setTimeout(() => setSuccess(false), 2000);
      } else {
        setError(result.error || 'Failed to update assignment');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusToggle = async () => {
    const newStatus = assignment.status === 'active' ? 'settled' : 'active';
    setIsUpdating(true);
    setError('');

    try {
      const result = await updatePettyCashAssignment(assignmentId, { status: newStatus });
      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      } else {
        setError(result.error || 'Failed to update status');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {success && (
        <span className="text-[10px] text-emerald-600">Success!</span>
      )}
      {error && (
        <span className="text-[10px] text-rose-600">{error}</span>
      )}
      
      <button
        onClick={handleStatusToggle}
        disabled={isUpdating}
        className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50"
        title={assignment.status === 'active' ? 'Mark as settled' : 'Mark as active'}
      >
        {assignment.status === 'active' ? (
          <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-amber-600" />
        )}
      </button>

      <button
        onClick={() => setIsEditing(!isEditing)}
        disabled={isUpdating}
        className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50"
        title="Edit amount"
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
        <div className="absolute right-0 top-full z-10 mt-2 rounded-lg border border-[var(--surface-border)] bg-white p-3 shadow-lg">
          <form onSubmit={handleUpdate} className="space-y-2">
            <label className="flex flex-col text-xs text-[var(--text-muted)]">
              <span className="font-semibold">New Amount (Cents)</span>
              <input
                type="number"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                placeholder={assignment.amountCents.toString()}
                className="mt-1 h-8 rounded border border-[var(--surface-border)] px-2 py-1 text-xs"
                required
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
