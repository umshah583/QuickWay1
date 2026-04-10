'use client';

import { useState, useEffect } from 'react';
import { assignPettyCashToStaff, getStaffMembers } from './actions';

type StaffMember = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
};

export default function AssignPettyCashForm() {
  const [staffId, setStaffId] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [amountCents, setAmountCents] = useState('');
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchStaff = async () => {
      setIsLoadingStaff(true);
      try {
        const staff = await getStaffMembers();
        setStaffMembers(staff);
      } catch (err) {
        console.error('Error fetching staff:', err);
      } finally {
        setIsLoadingStaff(false);
      }
    };

    fetchStaff();
  }, []);

  const handleStaffChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    setStaffId(selectedId);
    
    const selectedStaff = staffMembers.find(s => s.id === selectedId);
    if (selectedStaff) {
      setStaffName(selectedStaff.name || '');
      setStaffEmail(selectedStaff.email || '');
    }
  };

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

      if (!staffId || !staffName || !staffEmail) {
        setError('Please select a staff member');
        return;
      }

      const result = await assignPettyCashToStaff({
        staffId,
        staffName,
        staffEmail,
        amountCents: amount,
      });

      if (result.success) {
        setSuccess(true);
        setAmountCents('');
        setStaffId('');
        setStaffName('');
        setStaffEmail('');
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || 'Failed to assign petty cash');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-5 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-[var(--text-strong)]">Assign Petty Cash to Staff</h3>
      
      {success && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-600">
          Petty cash assigned successfully!
        </div>
      )}
      
      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-600">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex flex-col text-sm text-[var(--text-muted)]">
          <span className="font-semibold text-[var(--text-strong)]">Staff Member</span>
          <select
            value={staffId}
            onChange={handleStaffChange}
            disabled={isLoadingStaff}
            className="mt-1 h-10 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none disabled:opacity-50"
            required
          >
            <option value="">Select staff member...</option>
            {isLoadingStaff ? (
              <option value="" disabled>Loading staff...</option>
            ) : (
              staffMembers.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name} ({staff.email}) - {staff.role}
                </option>
              ))
            )}
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
        
        <button
          type="submit"
          disabled={isSubmitting || isLoadingStaff}
          className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-secondary)] disabled:opacity-50"
        >
          {isSubmitting ? 'Assigning...' : 'Assign Petty Cash'}
        </button>
      </form>
    </div>
  );
}
