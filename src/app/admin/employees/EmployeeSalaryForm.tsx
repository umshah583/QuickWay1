'use client';

import { useState, useEffect } from 'react';
import { createEmployeeSalary, getStaffMembers } from './actions';

type StaffMember = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
};

export default function EmployeeSalaryForm({ staff }: { staff: StaffMember[] }) {
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [monthlySalaryCents, setMonthlySalaryCents] = useState('');
  const [visaCostCents, setVisaCostCents] = useState('');
  const [visaMultiplier, setVisaMultiplier] = useState('');
  const [leaveSalaryCents, setLeaveSalaryCents] = useState('');
  const [leaveSalaryMultiplier, setLeaveSalaryMultiplier] = useState('');
  const [ticketCostCents, setTicketCostCents] = useState('');
  const [ticketMultiplier, setTicketMultiplier] = useState('');
  const [medicalInsuranceCents, setMedicalInsuranceCents] = useState('');
  const [medicalInsuranceMultiplier, setMedicalInsuranceMultiplier] = useState('');
  const [accommodationCostCents, setAccommodationCostCents] = useState('');
  const [accommodationMultiplier, setAccommodationMultiplier] = useState('');
  const [startDate, setStartDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleStaffChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    setUserId(selectedId);
    
    const selectedStaff = staff.find(s => s.id === selectedId);
    if (selectedStaff) {
      setUserName(selectedStaff.name || '');
      setUserEmail(selectedStaff.email || '');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setIsSubmitting(true);

    try {
      const salary = Number.parseInt(monthlySalaryCents, 10);
      if (Number.isNaN(salary) || salary <= 0) {
        setError('Salary must be a positive number');
        return;
      }

      if (!userId || !userName || !userEmail) {
        setError('Please select a staff member');
        return;
      }

      const result = await createEmployeeSalary({
        userId,
        userName,
        userEmail,
        monthlySalaryCents: salary,
        visaCostCents: visaCostCents ? Number.parseInt(visaCostCents, 10) : undefined,
        visaMultiplier: visaMultiplier ? Number.parseInt(visaMultiplier, 10) : undefined,
        leaveSalaryCents: leaveSalaryCents ? Number.parseInt(leaveSalaryCents, 10) : undefined,
        leaveSalaryMultiplier: leaveSalaryMultiplier ? Number.parseInt(leaveSalaryMultiplier, 10) : undefined,
        ticketCostCents: ticketCostCents ? Number.parseInt(ticketCostCents, 10) : undefined,
        ticketMultiplier: ticketMultiplier ? Number.parseInt(ticketMultiplier, 10) : undefined,
        medicalInsuranceCents: medicalInsuranceCents ? Number.parseInt(medicalInsuranceCents, 10) : undefined,
        medicalInsuranceMultiplier: medicalInsuranceMultiplier ? Number.parseInt(medicalInsuranceMultiplier, 10) : undefined,
        accommodationCostCents: accommodationCostCents ? Number.parseInt(accommodationCostCents, 10) : undefined,
        accommodationMultiplier: accommodationMultiplier ? Number.parseInt(accommodationMultiplier, 10) : undefined,
        startDate: startDate || new Date().toISOString().split('T')[0],
      });

      if (result.success) {
        setSuccess(true);
        setMonthlySalaryCents('');
        setVisaCostCents('');
        setVisaMultiplier('');
        setLeaveSalaryCents('');
        setLeaveSalaryMultiplier('');
        setTicketCostCents('');
        setTicketMultiplier('');
        setMedicalInsuranceCents('');
        setMedicalInsuranceMultiplier('');
        setAccommodationCostCents('');
        setAccommodationMultiplier('');
        setStartDate('');
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || 'Failed to set employee salary');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-5 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-[var(--text-strong)]">Set Employee Salary</h3>
      
      {success && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-600">
          Employee salary set successfully!
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
            value={userId}
            onChange={handleStaffChange}
            className="mt-1 h-10 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            required
          >
            <option value="">Select employee...</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.email}) - {s.role}
              </option>
            ))}
          </select>
        </label>
        
        <label className="flex flex-col text-sm text-[var(--text-muted)]">
          <span className="font-semibold text-[var(--text-strong)]">Monthly Salary (Cents)</span>
          <input
            type="number"
            value={monthlySalaryCents}
            onChange={(e) => setMonthlySalaryCents(e.target.value)}
            placeholder="e.g., 150000 for AED 1500.00"
            className="mt-1 h-10 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            required
          />
        </label>

        <div className="space-y-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-hover)] p-4">
          <h4 className="text-sm font-semibold text-[var(--text-strong)]">Optional UAE Labor Costs</h4>
          <p className="text-xs text-[var(--text-muted)]">Use divisor to divide annual costs by months (e.g., 12 for monthly, 1 for full amount)</p>
          
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col text-sm text-[var(--text-muted)]">
              <span className="font-medium text-[var(--text-strong)]">Visa Cost (Cents)</span>
              <input
                type="number"
                value={visaCostCents}
                onChange={(e) => setVisaCostCents(e.target.value)}
                placeholder="e.g., 50000 for AED 500.00"
                className="mt-1 h-9 rounded border border-[var(--surface-border)] bg-white px-3 py-1.5 text-xs text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </label>
            <label className="flex w-20 flex-col text-sm text-[var(--text-muted)]">
              <span className="font-medium text-[var(--text-strong)]">÷ Divisor</span>
              <input
                type="number"
                step="0.001"
                value={visaMultiplier}
                onChange={(e) => setVisaMultiplier(e.target.value)}
                placeholder="1"
                className="mt-1 h-9 rounded border border-[var(--surface-border)] bg-white px-2 py-1.5 text-xs text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </label>
          </div>

          <div className="flex gap-2">
            <label className="flex flex-1 flex-col text-sm text-[var(--text-muted)]">
              <span className="font-medium text-[var(--text-strong)]">Leave Salary (Cents)</span>
              <input
                type="number"
                value={leaveSalaryCents}
                onChange={(e) => setLeaveSalaryCents(e.target.value)}
                placeholder="e.g., 30000 for AED 300.00"
                className="mt-1 h-9 rounded border border-[var(--surface-border)] bg-white px-3 py-1.5 text-xs text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </label>
            <label className="flex w-20 flex-col text-sm text-[var(--text-muted)]">
              <span className="font-medium text-[var(--text-strong)]">÷ Divisor</span>
              <input
                type="number"
                step="0.001"
                value={leaveSalaryMultiplier}
                onChange={(e) => setLeaveSalaryMultiplier(e.target.value)}
                placeholder="1"
                className="mt-1 h-9 rounded border border-[var(--surface-border)] bg-white px-2 py-1.5 text-xs text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </label>
          </div>

          <div className="flex gap-2">
            <label className="flex flex-1 flex-col text-sm text-[var(--text-muted)]">
              <span className="font-medium text-[var(--text-strong)]">Ticket Cost (Cents) - After 2 Years</span>
              <input
                type="number"
                value={ticketCostCents}
                onChange={(e) => setTicketCostCents(e.target.value)}
                placeholder="e.g., 100000 for AED 1000.00"
                className="mt-1 h-9 rounded border border-[var(--surface-border)] bg-white px-3 py-1.5 text-xs text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </label>
            <label className="flex w-20 flex-col text-sm text-[var(--text-muted)]">
              <span className="font-medium text-[var(--text-strong)]">÷ Divisor</span>
              <input
                type="number"
                step="0.001"
                value={ticketMultiplier}
                onChange={(e) => setTicketMultiplier(e.target.value)}
                placeholder="1"
                className="mt-1 h-9 rounded border border-[var(--surface-border)] bg-white px-2 py-1.5 text-xs text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </label>
          </div>

          <div className="flex gap-2">
            <label className="flex flex-1 flex-col text-sm text-[var(--text-muted)]">
              <span className="font-medium text-[var(--text-strong)]">Medical Insurance (Cents)</span>
              <input
                type="number"
                value={medicalInsuranceCents}
                onChange={(e) => setMedicalInsuranceCents(e.target.value)}
                placeholder="e.g., 40000 for AED 400.00"
                className="mt-1 h-9 rounded border border-[var(--surface-border)] bg-white px-3 py-1.5 text-xs text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </label>
            <label className="flex w-20 flex-col text-sm text-[var(--text-muted)]">
              <span className="font-medium text-[var(--text-strong)]">÷ Divisor</span>
              <input
                type="number"
                step="0.001"
                value={medicalInsuranceMultiplier}
                onChange={(e) => setMedicalInsuranceMultiplier(e.target.value)}
                placeholder="1"
                className="mt-1 h-9 rounded border border-[var(--surface-border)] bg-white px-2 py-1.5 text-xs text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </label>
          </div>

          <div className="flex gap-2">
            <label className="flex flex-1 flex-col text-sm text-[var(--text-muted)]">
              <span className="font-medium text-[var(--text-strong)]">Accommodation (Cents)</span>
              <input
                type="number"
                value={accommodationCostCents}
                onChange={(e) => setAccommodationCostCents(e.target.value)}
                placeholder="e.g., 80000 for AED 800.00"
                className="mt-1 h-9 rounded border border-[var(--surface-border)] bg-white px-3 py-1.5 text-xs text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </label>
            <label className="flex w-20 flex-col text-sm text-[var(--text-muted)]">
              <span className="font-medium text-[var(--text-strong)]">÷ Divisor</span>
              <input
                type="number"
                step="0.001"
                value={accommodationMultiplier}
                onChange={(e) => setAccommodationMultiplier(e.target.value)}
                placeholder="1"
                className="mt-1 h-9 rounded border border-[var(--surface-border)] bg-white px-2 py-1.5 text-xs text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </label>
          </div>
        </div>
        
        <label className="flex flex-col text-sm text-[var(--text-muted)]">
          <span className="font-semibold text-[var(--text-strong)]">Start Date</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 h-10 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
          />
        </label>
        
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-secondary)] disabled:opacity-50"
        >
          {isSubmitting ? 'Setting...' : 'Set Salary'}
        </button>
      </form>
    </div>
  );
}
