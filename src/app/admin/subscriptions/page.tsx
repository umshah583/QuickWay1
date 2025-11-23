import Link from "next/link";
/* eslint-disable react/no-unescaped-entities */
import { prisma } from "@/lib/prisma";
import { Calendar, Package, User, Eye, Bell } from "lucide-react";
import { assignSubscriptionDriver } from "./actions";

export const dynamic = "force-dynamic";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(date);
}

type SearchParams = Record<string, string | string[] | undefined>;

type SubscriptionWithRelations = {
  id: string;
  status: string;
  startDate: Date;
  endDate: Date;
  washesRemaining: number;
  washesUsed: number;
  pricePaidCents: number;
  preferredWashDates: string[];
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    phoneNumber: string | null;
  };
  package: {
    id: string;
    name: string;
    duration: string;
    washesPerMonth: number;
  };
  driver: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
};

type DriverOption = {
  id: string;
  name: string | null;
  email: string | null;
};

function parseParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const tab = parseParam(params.tab) || "all";

  const now = new Date();
  // Use UAE timezone calendar day for matching subscription wash dates
  const todayIso = now.toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" }); // YYYY-MM-DD
  const today = new Date(todayIso + "T00:00:00+04:00");

  type PrismaWithPackages = typeof prisma & {
    packageSubscription: {
      findMany: (args: unknown) => Promise<SubscriptionWithRelations[]>;
    };
  };

  const subscriptionsDb = prisma as PrismaWithPackages;

  const [subscriptions, drivers] = await Promise.all([
    subscriptionsDb.packageSubscription.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
          },
        },
        package: {
          select: {
            id: true,
            name: true,
            duration: true,
            washesPerMonth: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: "DRIVER" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const activeCount = subscriptions.filter((s) => s.status === "ACTIVE").length;
  const totalRevenue = subscriptions
    .filter((s) => s.status === "ACTIVE")
    .reduce((sum, s) => sum + s.pricePaidCents, 0);

  const todaysAppointments = subscriptions.filter((s) => {
    const isActive = s.status === "ACTIVE" && s.washesRemaining > 0;
    const withinRange = s.startDate <= now && s.endDate >= now;
    const hasToday = s.preferredWashDates?.includes(todayIso);
    return isActive && withinRange && hasToday;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Subscriptions</h1>
          <p className="text-sm text-[var(--text-muted)]">View and manage customer subscription plans and daily wash tasks</p>
        </div>
        <Link
          href="/admin/subscriptions/requests"
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 px-4 py-2 text-sm font-semibold text-white transition hover:from-purple-700 hover:to-purple-800"
        >
          <Bell className="h-4 w-4" />
          Subscription Requests
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">Total Subscriptions</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{subscriptions.length}</p>
            </div>
            <div className="rounded-lg bg-[var(--primary-gradient)] p-3">
              <Package className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">Active Subscriptions</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{activeCount}</p>
            </div>
            <div className="rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 p-3">
              <Calendar className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">Active Revenue</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className="rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 p-3">
              <Package className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]">
        <div className="border-b border-[var(--card-border)] px-6 pt-4">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/subscriptions"
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                tab === "all"
                  ? "border-[var(--brand-primary)] text-[var(--brand-primary)]"
                  : "border-transparent text-[var(--text-medium)] hover:text-[var(--text-strong)]"
              }`}
            >
              All subscriptions
            </Link>
            <Link
              href="/admin/subscriptions?tab=today"
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                tab === "today"
                  ? "border-[var(--brand-primary)] text-[var(--brand-primary)]"
                  : "border-transparent text-[var(--text-medium)] hover:text-[var(--text-strong)]"
              }`}
            >
              Today's appointments
            </Link>
            <Link
              href="/admin/subscriptions/requests"
              className="border-b-2 border-transparent pb-3 text-sm font-medium text-[var(--text-medium)] transition-colors hover:text-[var(--text-strong)]"
            >
              Requests
            </Link>
          </div>
        </div>

        {tab === "today" ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-strong)]">Today's subscription washes</h2>
                <p className="text-sm text-[var(--text-muted)]">
                  Subscriptions that have a wash scheduled for today ({todayIso}). Assign drivers to handle these tasks.
                </p>
              </div>
            </div>

            {todaysAppointments.length === 0 ? (
              <div className="p-10 text-center text-sm text-[var(--text-muted)]">
                No subscription washes scheduled for today.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-[var(--card-border)] bg-[var(--surface-secondary)]">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                        Package
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                        Wash day
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                        Driver
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--card-border)]">
                    {todaysAppointments.map((sub) => (
                      <tr key={sub.id} className="hover:bg-[var(--hover-bg)] transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="rounded-full bg-[var(--surface-secondary)] p-2">
                              <User className="h-4 w-4 text-[var(--text-medium)]" />
                            </div>
                            <div>
                              <div className="font-medium text-[var(--text-strong)]">{sub.user.name || "Unknown"}</div>
                              <div className="text-xs text-[var(--text-muted)]">{sub.user.email || sub.user.phoneNumber}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-[var(--text-strong)]">{sub.package.name}</div>
                            <div className="text-xs text-[var(--text-muted)]">{sub.package.duration}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-[var(--text-medium)]">
                          <div>{formatDate(today)}</div>
                          <div className="text-xs text-[var(--text-muted)]">From subscription schedule</div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <form action={assignSubscriptionDriver} className="flex items-center gap-2">
                            <input type="hidden" name="subscriptionId" value={sub.id} />
                            <select
                              name="driverId"
                              defaultValue={sub.driver?.id ?? ""}
                              className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-1.5 text-xs text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                            >
                              <option value="">Unassigned</option>
                              {drivers.map((driver: DriverOption) => (
                                <option key={driver.id} value={driver.id}>
                                  {driver.name || driver.email || "Driver"}
                                </option>
                              ))}
                            </select>
                            <button
                              type="submit"
                              className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)]"
                            >
                              Assign
                            </button>
                          </form>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              sub.status === "ACTIVE"
                                ? "bg-green-100 text-green-800"
                                : sub.status === "EXPIRED"
                                ? "bg-gray-100 text-gray-800"
                                : sub.status === "CANCELLED"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {sub.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/admin/subscriptions/${sub.id}`}
                            className="rounded-lg p-2 text-[var(--text-medium)] hover:bg-[var(--hover-bg)] hover:text-[var(--brand-primary)] transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* All Subscriptions List */}
            {subscriptions.length === 0 ? (
              <div className="p-12 text-center">
                <Package className="mx-auto h-12 w-12 text-[var(--text-muted)] opacity-50" />
                <p className="mt-4 text-sm text-[var(--text-muted)]">No subscriptions yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-[var(--card-border)] bg-[var(--surface-secondary)]">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                        Package
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                        Period
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                        Washes
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                        Schedule Days
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                        Revenue
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--card-border)]">
                    {subscriptions.map((sub: SubscriptionWithRelations) => (
                      <tr key={sub.id} className="hover:bg-[var(--hover-bg)] transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="rounded-full bg-[var(--surface-secondary)] p-2">
                              <User className="h-4 w-4 text-[var(--text-medium)]" />
                            </div>
                            <div>
                              <div className="font-medium text-[var(--text-strong)]">{sub.user.name || "Unknown"}</div>
                              <div className="text-xs text-[var(--text-muted)]">{sub.user.email || sub.user.phoneNumber}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-[var(--text-strong)]">{sub.package.name}</div>
                            <div className="text-xs text-[var(--text-muted)]">{sub.package.duration}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <div className="text-[var(--text-strong)]">{formatDate(sub.startDate)}</div>
                            <div className="text-xs text-[var(--text-muted)]">to {formatDate(sub.endDate)}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <div className="font-medium text-[var(--text-strong)]">
                              {sub.washesRemaining} remaining
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">
                              {sub.washesUsed} used
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-[var(--text-medium)]">
                            {sub.preferredWashDates.length > 0 ? (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{sub.preferredWashDates.length} days selected</span>
                              </div>
                            ) : (
                              <span className="text-[var(--text-muted)]">No schedule</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              sub.status === "ACTIVE"
                                ? "bg-green-100 text-green-800"
                                : sub.status === "EXPIRED"
                                ? "bg-gray-100 text-gray-800"
                                : sub.status === "CANCELLED"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {sub.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-semibold text-[var(--text-strong)]">
                            {formatCurrency(sub.pricePaidCents)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/admin/subscriptions/${sub.id}`}
                              className="rounded-lg p-2 text-[var(--text-medium)] hover:bg-[var(--hover-bg)] hover:text-[var(--brand-primary)] transition-colors"
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
