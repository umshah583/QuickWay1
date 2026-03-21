"use client";

import { format } from "date-fns";
import { Eye, MapPin, User, DollarSign } from "lucide-react";
import Link from "next/link";

type Booking = {
  id: string;
  createdAt: Date;
  status: string;
  taskStatus: string | null;
  service: { name: string; priceCents: number } | null;
  user: { name: string | null; email: string | null } | null;
  payment: { status: string; amountCents: number } | null;
  cashCollected: boolean;
  cashAmountCents: number | null;
  location?: string | null;
};

interface RecentBookingsTableProps {
  bookings: Booking[];
}

export function RecentBookingsTable({ bookings }: RecentBookingsTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return "bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-700 border-emerald-300";
      case "PENDING":
        return "bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-700 border-amber-300";
      case "CANCELLED":
        return "bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-700 border-red-300";
      case "COMPLETED":
        return "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-700 border-cyan-300";
      default:
        return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  const getTaskStatusColor = (taskStatus: string | null) => {
    switch (taskStatus) {
      case "COMPLETED":
        return "bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-700 border-emerald-300";
      case "IN_PROGRESS":
        return "bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-700 border-blue-300";
      case "ASSIGNED":
        return "bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-700 border-purple-300";
      default:
        return "bg-gray-100 text-gray-600 border-gray-300";
    }
  };

  const formatCurrency = (cents: number) => {
    return `AED ${(cents / 100).toFixed(2)}`;
  };

  const getAmount = (booking: Booking) => {
    if (booking.payment?.status === "PAID") {
      return formatCurrency(booking.payment.amountCents);
    }
    if (booking.cashCollected && booking.cashAmountCents) {
      return formatCurrency(booking.cashAmountCents);
    }
    if (booking.service) {
      return formatCurrency(booking.service.priceCents);
    }
    return "N/A";
  };

  return (
    <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm shadow-lg overflow-hidden">
      <div className="px-6 py-5 border-b border-[var(--surface-border)] bg-gradient-to-r from-[var(--brand-primary)]/5 to-[var(--brand-aqua)]/5">
        <h2 className="text-lg font-bold text-gradient bg-gradient-to-r from-[var(--brand-navy)] to-[var(--brand-primary)] bg-clip-text text-transparent">
          Recent Bookings
        </h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">Latest booking requests and their status</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--surface-secondary)] backdrop-blur-sm">
              <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                Booking ID
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
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                Task Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--surface-border)]">
            {bookings.map((booking) => (
              <tr
                key={booking.id}
                className="bg-[var(--surface)] backdrop-blur-sm hover:bg-[var(--hover-bg)] transition-all hover:scale-[1.01]"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-aqua)] text-xs font-bold text-white">
                      #{booking.id.slice(-4).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-[var(--text-strong)]">
                      {booking.id.slice(0, 8)}...
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-[var(--text-muted)]" />
                    <div>
                      <div className="text-sm font-medium text-[var(--text-strong)]">
                        {booking.user?.name || "Guest"}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {booking.user?.email || "N/A"}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-[var(--text-strong)]">
                    {booking.service?.name || "N/A"}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4 text-[var(--brand-primary)]" />
                    <span className="text-sm font-semibold text-[var(--text-strong)]">
                      {getAmount(booking)}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(booking.status)}`}>
                    {booking.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getTaskStatusColor(booking.taskStatus)}`}>
                    {booking.taskStatus || "UNASSIGNED"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-medium)]">
                  {format(new Date(booking.createdAt), "MMM dd, yyyy")}
                  <div className="text-xs text-[var(--text-muted)]">
                    {format(new Date(booking.createdAt), "hh:mm a")}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link
                    href={`/admin/bookings/${booking.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[var(--brand-primary)]/10 to-[var(--brand-aqua)]/5 border border-[var(--brand-primary)]/20 text-[var(--brand-primary)] text-xs font-semibold hover:from-[var(--brand-primary)]/20 hover:to-[var(--brand-aqua)]/10 transition-all hover:scale-105"
                  >
                    <Eye className="h-3 w-3" />
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {bookings.length === 0 && (
        <div className="px-6 py-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-[var(--brand-primary)]/10 to-[var(--brand-aqua)]/5 mb-4">
            <MapPin className="h-8 w-8 text-[var(--text-muted)]" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-strong)] mb-2">No bookings yet</h3>
          <p className="text-sm text-[var(--text-muted)]">Bookings will appear here once customers start placing orders</p>
        </div>
      )}

      <div className="px-6 py-4 border-t border-[var(--surface-border)] bg-[var(--surface-secondary)]/50">
        <Link
          href="/admin/bookings"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand-primary)] hover:text-[var(--brand-aqua)] transition-colors"
        >
          View all bookings
          <span>→</span>
        </Link>
      </div>
    </div>
  );
}
