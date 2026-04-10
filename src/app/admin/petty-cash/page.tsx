import { format } from 'date-fns';
import { getStaffPettyCashSummaries, getPettyCashAssignments } from './actions';
import AssignPettyCashForm from './AssignPettyCashForm';
import PettyCashActions from './PettyCashActions';

export const dynamic = 'force-dynamic';

export default async function PettyCashPage() {
  const [summaries, assignments] = await Promise.all([
    getStaffPettyCashSummaries(),
    getPettyCashAssignments(),
  ]);

  function formatCurrency(cents: number) {
    const amount = cents / 100;
    return `AED ${amount.toFixed(2)}`;
  }

  function getCategoryColor(category: string) {
    const colors: Record<string, string> = {
      'Office Supplies': 'bg-blue-100 text-blue-700',
      'Transportation': 'bg-green-100 text-green-700',
      'Food': 'bg-orange-100 text-orange-700',
      'Utilities': 'bg-purple-100 text-purple-700',
      'Miscellaneous': 'bg-gray-100 text-gray-700',
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
  }

  const totalAssigned = summaries.reduce((sum, s) => sum + s.totalAssigned, 0);
  const totalVerified = summaries.reduce((sum, s) => sum + s.totalVerified, 0);
  const totalOutstanding = summaries.reduce((sum, s) => sum + s.outstandingBalance, 0);

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--brand-primary)]">Cash Management</p>
        <h1 className="text-3xl font-semibold text-[var(--text-strong)]">Petty Cash</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Assign petty cash to staff members and verify receipts for settlement.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-sm">
          <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Total Assigned</h2>
          <p className="mt-3 text-2xl font-semibold text-emerald-600">
            {formatCurrency(totalAssigned)}
          </p>
          <p className="text-xs text-[var(--text-muted)]">Cash assigned to staff</p>
        </article>
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-sm">
          <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Total Verified</h2>
          <p className="mt-3 text-2xl font-semibold text-blue-600">
            {formatCurrency(totalVerified)}
          </p>
          <p className="text-xs text-[var(--text-muted)]">Receipts verified</p>
        </article>
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-sm">
          <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Outstanding Balance</h2>
          <p className={`mt-3 text-2xl font-semibold ${totalOutstanding >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {formatCurrency(totalOutstanding)}
          </p>
          <p className="text-xs text-[var(--text-muted)]">Pending verification</p>
        </article>
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-sm">
          <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Staff Members</h2>
          <p className="mt-3 text-2xl font-semibold text-[var(--text-strong)]">
            {summaries.length}
          </p>
          <p className="text-xs text-[var(--text-muted)]">With petty cash</p>
        </article>
      </section>

      <AssignPettyCashForm />

      <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-7 shadow-sm">
        <header className="mb-5">
          <h2 className="text-lg font-semibold text-[var(--text-strong)]">Staff Petty Cash Summary</h2>
          <p className="text-sm text-[var(--text-muted)]">Outstanding balances per staff member.</p>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
              <tr>
                <th className="px-2 py-2">Staff Name</th>
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Total Assigned</th>
                <th className="px-2 py-2">Total Verified</th>
                <th className="px-2 py-2">Outstanding</th>
                <th className="px-2 py-2">Pending Receipts</th>
                <th className="px-2 py-2">Assignments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {summaries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-4 text-center text-xs text-[var(--text-muted)]">
                    No petty cash assignments found.
                  </td>
                </tr>
              ) : (
                summaries.map((summary) => (
                  <tr key={summary.staffId} className="bg-white/5 align-top">
                    <td className="px-2 py-2 font-semibold text-[var(--text-strong)]">
                      {summary.staffName}
                    </td>
                    <td className="px-2 py-2 text-[var(--text-muted)]">
                      {summary.staffEmail}
                    </td>
                    <td className="px-2 py-2 text-emerald-600 whitespace-nowrap">
                      {formatCurrency(summary.totalAssigned)}
                    </td>
                    <td className="px-2 py-2 text-blue-600 whitespace-nowrap">
                      {formatCurrency(summary.totalVerified)}
                    </td>
                    <td className={`px-2 py-2 font-semibold whitespace-nowrap ${summary.outstandingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {formatCurrency(summary.outstandingBalance)}
                    </td>
                    <td className="px-2 py-2 text-[var(--text-muted)] whitespace-nowrap">
                      {summary.pendingReceipts}
                    </td>
                    <td className="px-2 py-2 text-[var(--text-muted)] whitespace-nowrap">
                      {summary.assignmentCount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-7 shadow-sm">
        <header className="mb-5">
          <h2 className="text-lg font-semibold text-[var(--text-strong)]">Recent Assignments</h2>
          <p className="text-sm text-[var(--text-muted)]">Latest petty cash assignments and their receipts.</p>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
              <tr>
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Staff</th>
                <th className="px-2 py-2">Amount</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Receipts</th>
                <th className="px-2 py-2">Verified</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {assignments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-4 text-center text-xs text-[var(--text-muted)]">
                    No assignments found.
                  </td>
                </tr>
              ) : (
                assignments.map((assignment) => (
                  <tr key={assignment.id} className="bg-white/5 align-top">
                    <td className="px-2 py-2 text-[var(--text-muted)] whitespace-nowrap">
                      {format(new Date(assignment.assignedAt), 'd MMM yyyy, h:mma')}
                    </td>
                    <td className="px-2 py-2 text-[var(--text-muted)]">
                      <span className="flex flex-col">
                        <span className="font-semibold text-[var(--text-strong)]">{assignment.staffName}</span>
                        <span className="text-[10px]">{assignment.staffEmail}</span>
                      </span>
                    </td>
                    <td className="px-2 py-2 font-semibold text-[var(--text-strong)] whitespace-nowrap">
                      {formatCurrency(assignment.amountCents)}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <span className={`inline-block rounded-full px-2 py-1 text-[10px] font-medium ${
                        assignment.status === 'settled' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {assignment.status === 'settled' ? 'Settled' : 'Active'}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-[var(--text-muted)] whitespace-nowrap">
                      {assignment.receipts.length}
                    </td>
                    <td className="px-2 py-2 text-[var(--text-muted)] whitespace-nowrap">
                      {assignment.receipts.filter(r => r.verified).length}/{assignment.receipts.length}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <PettyCashActions assignmentId={assignment.id} assignment={assignment} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
