"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { 
  DollarSign, 
  TrendingUp, 
  CreditCard, 
  Banknote, 
  Users, 
  RefreshCw,
  Download,
  Calendar,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";

type Transaction = {
  id: string;
  createdAt: Date;
  status: string;
  amountCents: number;
  provider: string | null;
  booking: {
    service: { name: string } | null;
    user: { name: string | null; email: string | null } | null;
  } | null;
};

type RevenueTrendData = {
  date: string;
  total: number;
  online: number;
  cash: number;
};

type PaymentBreakdownData = {
  method: string;
  amount: number;
  count: number;
};

interface FinanceDashboardClientProps {
  totalRevenue: number;
  onlineRevenue: number;
  cashRevenue: number;
  totalCommissions: number;
  settledPayments: number;
  refunds: number;
  revenueTrend: RevenueTrendData[];
  paymentBreakdown: PaymentBreakdownData[];
  transactions: Transaction[];
}

export function FinanceDashboardClient({
  totalRevenue,
  onlineRevenue,
  cashRevenue,
  totalCommissions,
  settledPayments,
  refunds,
  revenueTrend,
  paymentBreakdown,
  transactions,
}: FinanceDashboardClientProps) {
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const formatCurrency = (cents: number) => {
    return `AED ${(cents / 100).toFixed(2)}`;
  };

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => {
      if (statusFilter !== "all" && transaction.status !== statusFilter) return false;
      
      if (dateFilter !== "all") {
        const transactionDate = new Date(transaction.createdAt);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        switch (dateFilter) {
          case "today":
            const todayEnd = new Date(today);
            todayEnd.setHours(23, 59, 59, 999);
            if (transactionDate < today || transactionDate > todayEnd) return false;
            break;
          case "week":
            const weekAgo = new Date(today);
            weekAgo.setDate(today.getDate() - 7);
            if (transactionDate < weekAgo) return false;
            break;
          case "month":
            const monthAgo = new Date(today);
            monthAgo.setMonth(today.getMonth() - 1);
            if (transactionDate < monthAgo) return false;
            break;
        }
      }
      
      return true;
    });
  }, [transactions, dateFilter, statusFilter]);

  const exportToCSV = () => {
    const headers = ["Date", "Transaction ID", "Customer", "Service", "Amount", "Method", "Status"];
    const rows = filteredTransactions.map(t => [
      format(new Date(t.createdAt), "yyyy-MM-dd HH:mm:ss"),
      t.id,
      t.booking?.user?.name || t.booking?.user?.email || "N/A",
      t.booking?.service?.name || "N/A",
      formatCurrency(t.amountCents),
      t.provider || "N/A",
      t.status,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quickway-transactions-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const netRevenue = totalRevenue - totalCommissions;
  const cashPercentage = totalRevenue > 0 ? (cashRevenue / totalRevenue) * 100 : 0;
  const onlinePercentage = totalRevenue > 0 ? (onlineRevenue / totalRevenue) * 100 : 0;

  // Calculate max value for chart scaling
  const maxRevenue = Math.max(...revenueTrend.map(d => d.total));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gradient bg-gradient-to-r from-[var(--brand-navy)] to-[var(--brand-primary)] bg-clip-text text-transparent">
            Finance Dashboard
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Track revenue, payments, and financial metrics
          </p>
        </div>
        <button
          onClick={exportToCSV}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-aqua)] text-white font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Revenue */}
        <div className="glass-card relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500 via-sky-500 to-blue-500 p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-white/90 uppercase tracking-wide">Total Revenue</p>
              <p className="mt-3 text-3xl font-bold text-white drop-shadow-lg">{formatCurrency(totalRevenue)}</p>
              <p className="mt-2 text-xs text-white/80 font-medium">Net: {formatCurrency(netRevenue)}</p>
            </div>
            <div className="rounded-2xl bg-white/20 backdrop-blur-sm p-4 shadow-lg">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
        </div>

        {/* Online Payments */}
        <div className="glass-card relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-white/90 uppercase tracking-wide">Online Payments</p>
              <p className="mt-3 text-3xl font-bold text-white drop-shadow-lg">{formatCurrency(onlineRevenue)}</p>
              <p className="mt-2 text-xs text-white/80 font-medium">{onlinePercentage.toFixed(1)}% of total</p>
            </div>
            <div className="rounded-2xl bg-white/20 backdrop-blur-sm p-4 shadow-lg">
              <CreditCard className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
        </div>

        {/* Cash Payments */}
        <div className="glass-card relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500 via-cyan-500 to-sky-500 p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-white/90 uppercase tracking-wide">Cash Payments</p>
              <p className="mt-3 text-3xl font-bold text-white drop-shadow-lg">{formatCurrency(cashRevenue)}</p>
              <p className="mt-2 text-xs text-white/80 font-medium">{cashPercentage.toFixed(1)}% of total</p>
            </div>
            <div className="rounded-2xl bg-white/20 backdrop-blur-sm p-4 shadow-lg">
              <Banknote className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
        </div>

        {/* Commissions */}
        <div className="glass-card relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-white/90 uppercase tracking-wide">Commissions</p>
              <p className="mt-3 text-3xl font-bold text-white drop-shadow-lg">{formatCurrency(totalCommissions)}</p>
              <p className="mt-2 text-xs text-white/80 font-medium">Partner payouts</p>
            </div>
            <div className="rounded-2xl bg-white/20 backdrop-blur-sm p-4 shadow-lg">
              <Users className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
        </div>

        {/* Settlements */}
        <div className="glass-card relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-500 p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-white/90 uppercase tracking-wide">Settlements</p>
              <p className="mt-3 text-3xl font-bold text-white drop-shadow-lg">{settledPayments}</p>
              <p className="mt-2 text-xs text-white/80 font-medium">Completed payments</p>
            </div>
            <div className="rounded-2xl bg-white/20 backdrop-blur-sm p-4 shadow-lg">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
        </div>

        {/* Refunds */}
        <div className="glass-card relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-white/90 uppercase tracking-wide">Refunds</p>
              <p className="mt-3 text-3xl font-bold text-white drop-shadow-lg">{formatCurrency(refunds)}</p>
              <p className="mt-2 text-xs text-white/80 font-medium">Returned payments</p>
            </div>
            <div className="rounded-2xl bg-white/20 backdrop-blur-sm p-4 shadow-lg">
              <RefreshCw className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend Line Chart */}
        <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-6 shadow-lg">
          <h3 className="text-lg font-bold text-[var(--text-strong)] mb-6">Revenue Trend (30 Days)</h3>
          <div className="h-64 relative">
            {/* Simple line chart visualization */}
            <div className="absolute inset-0 flex items-end justify-between gap-1">
              {revenueTrend.map((data, index) => {
                const height = maxRevenue > 0 ? (data.total / maxRevenue) * 100 : 0;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col justify-end h-full">
                      <div
                        className="w-full bg-gradient-to-t from-[var(--brand-primary)] to-[var(--brand-aqua)] rounded-t-lg transition-all hover:opacity-80 relative group"
                        style={{ height: `${height}%` }}
                      >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-[var(--brand-navy)] text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                          {format(new Date(data.date), "MMM dd")}<br />
                          {formatCurrency(data.total)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-aqua)]"></div>
              <span className="text-[var(--text-muted)]">Total Revenue</span>
            </div>
          </div>
        </div>

        {/* Payment Method Bar Chart */}
        <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-6 shadow-lg">
          <h3 className="text-lg font-bold text-[var(--text-strong)] mb-6">Payment Methods</h3>
          <div className="space-y-6">
            {paymentBreakdown.map((item, index) => {
              const percentage = totalRevenue > 0 ? (item.amount / totalRevenue) * 100 : 0;
              return (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {item.method.includes("Online") ? (
                        <CreditCard className="h-4 w-4 text-[var(--brand-primary)]" />
                      ) : (
                        <Banknote className="h-4 w-4 text-[var(--brand-primary)]" />
                      )}
                      <span className="text-sm font-semibold text-[var(--text-strong)]">{item.method}</span>
                    </div>
                    <span className="text-sm font-bold text-[var(--brand-primary)]">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                  <div className="relative h-8 bg-[var(--surface-secondary)] rounded-xl overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-aqua)] rounded-xl transition-all"
                      style={{ width: `${percentage}%` }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white">
                        {percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    {item.count} transactions
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm shadow-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-[var(--surface-border)] bg-gradient-to-r from-[var(--brand-primary)]/5 to-[var(--brand-aqua)]/5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gradient bg-gradient-to-r from-[var(--brand-navy)] to-[var(--brand-primary)] bg-clip-text text-transparent">
                Recent Transactions
              </h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">All payment transactions</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-4 py-2 bg-white/60 backdrop-blur-sm border-2 border-[var(--surface-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-primary)] transition-all"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 bg-white/60 backdrop-blur-sm border-2 border-[var(--surface-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-primary)] transition-all"
              >
                <option value="all">All Status</option>
                <option value="PAID">Paid</option>
                <option value="REFUNDED">Refunded</option>
                <option value="REQUIRES_PAYMENT">Pending</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--surface-secondary)] backdrop-blur-sm">
                <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                  Transaction ID
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                  Service
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {filteredTransactions.slice(0, 50).map((transaction) => (
                <tr
                  key={transaction.id}
                  className="bg-[var(--surface)] backdrop-blur-sm hover:bg-[var(--hover-bg)] transition-all"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-[var(--text-muted)]" />
                      <div>
                        <div className="text-sm font-medium text-[var(--text-strong)]">
                          {format(new Date(transaction.createdAt), "MMM dd, yyyy")}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {format(new Date(transaction.createdAt), "hh:mm a")}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-mono text-[var(--text-medium)]">
                      {transaction.id.slice(0, 12)}...
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-[var(--text-strong)]">
                      {transaction.booking?.user?.name || "Guest"}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {transaction.booking?.user?.email || "N/A"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-medium)]">
                    {transaction.booking?.service?.name || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {transaction.status === "PAID" ? (
                        <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                      ) : transaction.status === "REFUNDED" ? (
                        <ArrowDownRight className="h-4 w-4 text-red-500" />
                      ) : null}
                      <span className="text-sm font-semibold text-[var(--text-strong)]">
                        {formatCurrency(transaction.amountCents)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {transaction.provider === "STRIPE" ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-700 border border-blue-300">
                        <CreditCard className="h-3 w-3" />
                        Online
                      </span>
                    ) : transaction.provider === "CASH" ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-teal-500/20 to-cyan-500/20 text-teal-700 border border-teal-300">
                        <Banknote className="h-3 w-3" />
                        Cash
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {transaction.status === "PAID" ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-700 border border-emerald-300">
                        Paid
                      </span>
                    ) : transaction.status === "REFUNDED" ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-700 border border-red-300">
                        Refunded
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-700 border border-amber-300">
                        Pending
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredTransactions.length === 0 && (
          <div className="px-6 py-12 text-center">
            <DollarSign className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-[var(--text-strong)] mb-2">No transactions found</h3>
            <p className="text-sm text-[var(--text-muted)]">
              {dateFilter !== "all" || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "Transactions will appear here once payments are processed"}
            </p>
          </div>
        )}

        <div className="px-6 py-4 border-t border-[var(--surface-border)] bg-[var(--surface-secondary)]/50">
          <p className="text-sm text-[var(--text-muted)]">
            Showing {Math.min(filteredTransactions.length, 50)} of {filteredTransactions.length} transactions
          </p>
        </div>
      </div>
    </div>
  );
}
