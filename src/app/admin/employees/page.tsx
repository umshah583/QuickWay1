import { format } from 'date-fns';
import { getEmployeeSummaries, getEmployeeExpenses, getEmployeePayouts, getStaffMembers } from './actions';
import EmployeeSalaryForm from './EmployeeSalaryForm';
import EmployeeExpenseForm from './EmployeeExpenseForm';
import EmployeeExpenseActions from './EmployeeExpenseActions';
import PayoutForm from './PayoutForm';
import PayoutActions from './PayoutActions';

export const dynamic = 'force-dynamic';

export default async function EmployeesPage() {
  const [summaries, expenses, payouts, staff] = await Promise.all([
    getEmployeeSummaries(),
    getEmployeeExpenses(),
    getEmployeePayouts(),
    getStaffMembers(),
  ]);

  function formatCurrency(cents: number) {
    const amount = cents / 100;
    return `AED ${amount.toFixed(2)}`;
  }

  function getStatusColor(status: string) {
    const colors: Record<string, string> = {
      'pending': 'bg-amber-100 text-amber-700',
      'approved': 'bg-emerald-100 text-emerald-700',
      'rejected': 'bg-rose-100 text-rose-700',
      'paid': 'bg-blue-100 text-blue-700',
      'cancelled': 'bg-gray-100 text-gray-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  }

  const totalPayroll = summaries.reduce((sum, s) => sum + s.netPayable, 0);
  const totalExpenses = summaries.reduce((sum, s) => sum + s.totalExpenses, 0);
  const totalPending = summaries.reduce((sum, s) => sum + s.pendingExpenses, 0);

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--brand-primary)]">HR Management</p>
        <h1 className="text-3xl font-semibold text-[var(--text-strong)]">Employee Management</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Manage employee salaries, expenses, and monthly payouts.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-sm">
          <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Total Payroll</h2>
          <p className="mt-3 text-2xl font-semibold text-emerald-600">
            {formatCurrency(totalPayroll)}
          </p>
          <p className="text-xs text-[var(--text-muted)]">Net payable salary</p>
        </article>
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-sm">
          <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Total Expenses</h2>
          <p className="mt-3 text-2xl font-semibold text-rose-600">
            {formatCurrency(totalExpenses)}
          </p>
          <p className="text-xs text-[var(--text-muted)]">Approved deductions</p>
        </article>
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-sm">
          <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Pending Expenses</h2>
          <p className="mt-3 text-2xl font-semibold text-amber-600">
            {formatCurrency(totalPending)}
          </p>
          <p className="text-xs text-[var(--text-muted)]">Awaiting approval</p>
        </article>
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-sm">
          <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Employees</h2>
          <p className="mt-3 text-2xl font-semibold text-[var(--text-strong)]">
            {summaries.length}
          </p>
          <p className="text-xs text-[var(--text-muted)]">Active staff</p>
        </article>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <EmployeeSalaryForm staff={staff} />
        <EmployeeExpenseForm staff={staff} />
        <PayoutForm />
      </div>

      <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-7 shadow-sm">
        <header className="mb-5">
          <h2 className="text-lg font-semibold text-[var(--text-strong)]">Employee Summary</h2>
          <p className="text-sm text-[var(--text-muted)]">Salary, expenses, and net payable per employee.</p>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
              <tr>
                <th className="px-2 py-2">Employee</th>
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Monthly Salary</th>
                <th className="px-2 py-2">Total Cost</th>
                <th className="px-2 py-2">Total Expenses</th>
                <th className="px-2 py-2">Pending</th>
                <th className="px-2 py-2">Net Payable</th>
                <th className="px-2 py-2">Last Payout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {summaries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 py-4 text-center text-xs text-[var(--text-muted)]">
                    No employees found.
                  </td>
                </tr>
              ) : (
                summaries.map((summary) => (
                  <tr key={summary.employeeId} className="bg-white/5 align-top">
                    <td className="px-2 py-2 font-semibold text-[var(--text-strong)]">
                      {summary.userName}
                    </td>
                    <td className="px-2 py-2 text-[var(--text-muted)]">
                      {summary.userEmail}
                    </td>
                    <td className="px-2 py-2 text-emerald-600 whitespace-nowrap">
                      {formatCurrency(summary.monthlySalaryCents)}
                    </td>
                    <td className="px-2 py-2 text-blue-600 whitespace-nowrap">
                      {formatCurrency(summary.totalCostCents)}
                    </td>
                    <td className="px-2 py-2 text-rose-600 whitespace-nowrap">
                      {formatCurrency(summary.totalExpenses)}
                    </td>
                    <td className={`px-2 py-2 font-semibold whitespace-nowrap ${summary.pendingExpenses > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {formatCurrency(summary.pendingExpenses)}
                    </td>
                    <td className={`px-2 py-2 font-semibold whitespace-nowrap ${summary.netPayable >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatCurrency(summary.netPayable)}
                    </td>
                    <td className="px-2 py-2 text-[var(--text-muted)] whitespace-nowrap">
                      {summary.lastPayoutMonth || '—'}
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
          <h2 className="text-lg font-semibold text-[var(--text-strong)]">Recent Expenses</h2>
          <p className="text-sm text-[var(--text-muted)]">Employee expense records awaiting approval.</p>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
              <tr>
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Employee</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Amount</th>
                <th className="px-2 py-2">Category</th>
                <th className="px-2 py-2">Description</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 py-4 text-center text-xs text-[var(--text-muted)]">
                    No expenses found.
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr key={expense.id} className="bg-white/5 align-top">
                    <td className="px-2 py-2 text-[var(--text-muted)] whitespace-nowrap">
                      {format(new Date(expense.date), 'd MMM yyyy')}
                    </td>
                    <td className="px-2 py-2 text-[var(--text-muted)]">
                      {summaries.find(s => s.employeeId === expense.employeeId)?.userName || 'Unknown'}
                    </td>
                    <td className="px-2 py-2 text-[var(--text-muted)] whitespace-nowrap capitalize">
                      {expense.type.replace('_', ' ')}
                    </td>
                    <td className="px-2 py-2 font-semibold text-[var(--text-strong)] whitespace-nowrap">
                      {formatCurrency(expense.amountCents)}
                    </td>
                    <td className="px-2 py-2 text-[var(--text-muted)] whitespace-nowrap">
                      {expense.category}
                    </td>
                    <td className="px-2 py-2 text-[var(--text-muted)]">
                      {expense.description}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <span className={`inline-block rounded-full px-2 py-1 text-[10px] font-medium ${getStatusColor(expense.status)}`}>
                        {expense.status}
                      </span>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <EmployeeExpenseActions expenseId={expense.id} expense={expense} />
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
          <h2 className="text-lg font-semibold text-[var(--text-strong)]">Payout History</h2>
          <p className="text-sm text-[var(--text-muted)]">Monthly salary payouts to employees.</p>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
              <tr>
                <th className="px-2 py-2">Month/Year</th>
                <th className="px-2 py-2">Employee</th>
                <th className="px-2 py-2">Days Worked</th>
                <th className="px-2 py-2">Total Days</th>
                <th className="px-2 py-2">Gross Salary</th>
                <th className="px-2 py-2">Deductions</th>
                <th className="px-2 py-2">Net Salary</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Paid Date</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {payouts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-2 py-4 text-center text-xs text-[var(--text-muted)]">
                    No payouts found.
                  </td>
                </tr>
              ) : (
                payouts.map((payout) => (
                  <tr key={payout.id} className="bg-white/5 align-top">
                    <td className="px-2 py-2 text-[var(--text-muted)] whitespace-nowrap">
                      {payout.month}/{payout.year}
                    </td>
                    <td className="px-2 py-2 text-[var(--text-muted)]">
                      {summaries.find(s => s.employeeId === payout.employeeId)?.userName || 'Unknown'}
                    </td>
                    <td className="px-2 py-2 text-blue-600 whitespace-nowrap">
                      {payout.daysWorked}/{payout.totalDays}
                    </td>
                    <td className="px-2 py-2 text-[var(--text-muted)] whitespace-nowrap">
                      {payout.totalDays}
                    </td>
                    <td className="px-2 py-2 text-emerald-600 whitespace-nowrap">
                      {formatCurrency(payout.grossSalaryCents)}
                    </td>
                    <td className="px-2 py-2 text-rose-600 whitespace-nowrap">
                      {formatCurrency(payout.totalDeductionsCents)}
                    </td>
                    <td className="px-2 py-2 font-semibold text-[var(--text-strong)] whitespace-nowrap">
                      {formatCurrency(payout.netSalaryCents)}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <span className={`inline-block rounded-full px-2 py-1 text-[10px] font-medium ${getStatusColor(payout.status)}`}>
                        {payout.status}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-[var(--text-muted)] whitespace-nowrap">
                      {payout.paidAt ? format(new Date(payout.paidAt), 'MMM d, yyyy') : '-'}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <PayoutActions payoutId={payout.id} payout={payout} />
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
