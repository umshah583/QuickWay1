"use client";

import { useState } from "react";

type UsersManagementClientProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customers: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  drivers: any[];
  activeTab: "customers" | "drivers";
};

export default function UsersManagementClient({ 
  customers, 
  drivers, 
  activeTab 
}: UsersManagementClientProps) {
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const handleDeleteUser = async (userId: string, userType: 'customer' | 'driver') => {
    if (!confirm(`Are you sure you want to delete this ${userType}? This action cannot be undone.`)) {
      return;
    }

    setDeletingUserId(userId);
    
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      // Refresh the page to show updated list
      window.location.reload();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user. Please try again.');
    } finally {
      setDeletingUserId(null);
    }
  };

  // Render the users table with delete functionality
  return (
    <div>
      {activeTab === "customers" ? (
        <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
              <tr className="uppercase tracking-[0.16em] text-xs">
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Last engaged</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Lifetime value</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.slice(0, 15).map((customer) => {
                const bookings = customer.bookings;
                const lastBooking = bookings[0]?.startAt;
                const orderCount = bookings.length;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const lifetimeValueCents = bookings.reduce((sum: any, booking: any) => {
                  const payment = booking.payment?.amountCents ?? 0;
                  const cash = booking.cashCollected ? booking.cashAmountCents ?? booking.service?.priceCents ?? 0 : 0;
                  return sum + payment + cash;
                }, 0);

                const computeCustomerStatus = (latestBooking?: Date) => {
                  if (!latestBooking) {
                    return { label: "New", tone: "bg-sky-500/15 text-sky-400" };
                  }
                  const days = (Date.now() - latestBooking.getTime()) / 86_400_000;
                  if (days <= 30) {
                    return { label: "Active", tone: "bg-emerald-500/15 text-emerald-400" };
                  }
                  if (days <= 90) {
                    return { label: "Warm", tone: "bg-amber-500/15 text-amber-400" };
                  }
                  return { label: "Dormant", tone: "bg-rose-500/15 text-rose-400" };
                };

                const status = computeCustomerStatus(lastBooking);

                return (
                  <tr key={customer.id} className="border-t border-[var(--surface-border)]">
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <p className="font-semibold text-[var(--text-strong)]">{customer.name ?? customer.email ?? "Customer"}</p>
                        <p className="text-xs text-[var(--text-muted)]">{customer.email ?? "No email on file"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">
                      {/* eslint-disable @typescript-eslint/no-require-imports */}
                      {lastBooking ? require("date-fns").formatDistanceToNow(lastBooking, { addSuffix: true }) : "No orders yet"}
                      {/* eslint-enable @typescript-eslint/no-require-imports */}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{orderCount}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${status.tone}`}>{status.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[var(--text-strong)">
                      {new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(lifetimeValueCents / 100)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/admin/customers/${customer.id}`}
                          className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                        >
                          View
                        </a>
                        <a
                          href={`/admin/customers/${customer.id}/edit`}
                          className="inline-flex items-center justify-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600 transition hover:bg-amber-100"
                        >
                          Edit
                        </a>
                        <button
                          onClick={() => handleDeleteUser(customer.id, 'customer')}
                          disabled={deletingUserId === customer.id}
                          className="inline-flex items-center justify-center rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                        >
                          {deletingUserId === customer.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
              <tr className="uppercase tracking-[0.16em] text-xs">
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Completed</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const deriveDriverAvailability = (driver: any) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const active = driver.driverBookings.find((booking: any) => booking.taskStatus !== "COMPLETED");
                  if (active) {
                    return { label: "On job", tone: "bg-amber-500/15 text-amber-400" };
                  }
                  return { label: "Available", tone: "bg-emerald-500/15 text-emerald-400" };
                };

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const completedOrders = driver.driverBookings.filter((b: any) => b.taskStatus === "COMPLETED").length;
                const availability = deriveDriverAvailability(driver);

                return (
                  <tr key={driver.id} className="border-t border-[var(--surface-border)]">
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <p className="font-semibold text-[var(--text-strong)]">{driver.name ?? driver.email ?? "Driver"}</p>
                        <p className="text-xs text-[var(--text-muted)]">{driver.email ?? "No email on file"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${availability.tone}`}>{availability.label}</span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{completedOrders}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/admin/drivers/${driver.id}`}
                          className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                        >
                          View
                        </a>
                        <a
                          href={`/admin/drivers/${driver.id}/edit`}
                          className="inline-flex items-center justify-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600 transition hover:bg-amber-100"
                        >
                          Edit
                        </a>
                        <button
                          onClick={() => handleDeleteUser(driver.id, 'driver')}
                          disabled={deletingUserId === driver.id}
                          className="inline-flex items-center justify-center rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                        >
                          {deletingUserId === driver.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
