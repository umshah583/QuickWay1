/* eslint-disable react/no-unescaped-entities */
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Calendar, Package, User, CreditCard, ArrowLeft } from "lucide-react";
import { assignSubscriptionDriver, updateSubscriptionSchedule } from "../actions";

export const dynamic = "force-dynamic";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-AE", { dateStyle: "long" }).format(date);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-AE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

type SubscriptionDetail = {
  id: string;
  status: string;
  startDate: Date;
  endDate: Date;
  washesRemaining: number;
  washesUsed: number;
  pricePaidCents: number;
  paymentId: string | null;
  autoRenew: boolean;
  preferredWashDates: string[];
  createdAt: Date;
  updatedAt: Date;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  driver: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    phoneNumber: string | null;
  };
  package: {
    id: string;
    name: string;
    description: string | null;
    duration: string;
    washesPerMonth: number;
    priceCents: number;
  };
};

export default async function SubscriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  type PrismaWithPackages = typeof prisma & {
    packageSubscription: {
      findUnique: (args: unknown) => Promise<SubscriptionDetail | null>;
    };
  };

  const subscriptionsDb = prisma as PrismaWithPackages;
  const { id } = await params;

  const subscription = await subscriptionsDb.packageSubscription.findUnique({
    where: { id },
    include: {
      driver: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
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
          description: true,
          duration: true,
          washesPerMonth: true,
          priceCents: true,
        },
      },
    },
  });

  if (!subscription) {
    notFound();
  }

  const scheduleDates = subscription.preferredWashDates.map((dateStr) => {
    try {
      return new Date(dateStr);
    } catch {
      return null;
    }
  }).filter((d): d is Date => d !== null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/subscriptions"
          className="rounded-lg p-2 hover:bg-[var(--hover-bg)] transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-[var(--text-medium)]" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Subscription Details</h1>
          <p className="text-sm text-[var(--text-muted)]">View subscription information and schedule</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info */}
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-[var(--primary-gradient)] p-2">
                <User className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-[var(--text-strong)]">Customer Information</h2>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Name</p>
                <p className="text-sm font-medium text-[var(--text-strong)]">{subscription.user.name || "Unknown"}</p>
              </div>
              {subscription.user.email && (
                <div>
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Email</p>
                  <p className="text-sm font-medium text-[var(--text-strong)]">{subscription.user.email}</p>
                </div>
              )}
              {subscription.user.phoneNumber && (
                <div>
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Phone</p>
                  <p className="text-sm font-medium text-[var(--text-strong)]">{subscription.user.phoneNumber}</p>
                </div>
              )}
            </div>
          </div>

          {/* Package Info */}
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 p-2">
                <Package className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-[var(--text-strong)]">Package Details</h2>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Package Name</p>
                <p className="text-sm font-medium text-[var(--text-strong)]">{subscription.package.name}</p>
              </div>
              {subscription.package.description && (
                <div>
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Description</p>
                  <p className="text-sm text-[var(--text-medium)]">{subscription.package.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Duration</p>
                  <p className="text-sm font-medium text-[var(--text-strong)]">{subscription.package.duration}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Washes/Month</p>
                  <p className="text-sm font-medium text-[var(--text-strong)]">{subscription.package.washesPerMonth}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Wash Schedule */}
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 p-2">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-[var(--text-strong)]">Wash Schedule</h2>
            </div>
            {scheduleDates.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {scheduleDates.map((date, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-[var(--card-border)] bg-[var(--surface-secondary)] p-3 text-center"
                  >
                    <div className="text-xs text-[var(--text-muted)] uppercase">
                      {new Intl.DateTimeFormat("en-AE", { weekday: "short" }).format(date)}
                    </div>
                    <div className="text-lg font-semibold text-[var(--text-strong)] mt-1">
                      {date.getDate()}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {new Intl.DateTimeFormat("en-AE", { month: "short" }).format(date)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No wash schedule set</p>
            )}
            
            {/* Edit Schedule Form */}
            <div className="mt-6 pt-6 border-t border-[var(--card-border)]">
              <h3 className="text-sm font-semibold text-[var(--text-strong)] mb-3">Edit Schedule</h3>
              <form action={updateSubscriptionSchedule} className="space-y-3">
                <input type="hidden" name="subscriptionId" value={subscription.id} />
                <div>
                  <label htmlFor="scheduleDates" className="block text-xs text-[var(--text-muted)] mb-2">
                    Wash Dates (comma-separated YYYY-MM-DD, max {subscription.package.washesPerMonth} days)
                  </label>
                  <textarea
                    id="scheduleDates"
                    name="scheduleDates"
                    defaultValue={subscription.preferredWashDates.join(', ')}
                    rows={3}
                    placeholder="2025-01-15, 2025-01-22, 2025-01-29..."
                    className="w-full rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Currently {subscription.preferredWashDates.length} of {subscription.package.washesPerMonth} days selected
                  </p>
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-secondary)]"
                >
                  Update Schedule
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Driver Assignment */}
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
            <h3 className="text-sm font-semibold text-[var(--text-strong)] mb-4">Driver assignment</h3>
            <p className="text-xs text-[var(--text-muted)] mb-2">
              Assign a driver to handle this subscription's wash schedule. This assignment applies to the full schedule.
            </p>
            <form action={assignSubscriptionDriver} className="space-y-3">
              <input type="hidden" name="subscriptionId" value={subscription.id} />
              <div className="space-y-1 text-sm">
                <p className="text-[var(--text-muted)] uppercase tracking-wider text-xs">Current driver</p>
                <p className="font-medium text-[var(--text-strong)]">
                  {subscription.driver?.name || subscription.driver?.email || "Unassigned"}
                </p>
              </div>
              <DriverSelect initialDriverId={subscription.driver?.id ?? null} />
            </form>
          </div>

          {/* Status Card */}
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
            <h3 className="text-sm font-semibold text-[var(--text-strong)] mb-4">Subscription Status</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Status</p>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    subscription.status === "ACTIVE"
                      ? "bg-green-100 text-green-800"
                      : subscription.status === "EXPIRED"
                      ? "bg-gray-100 text-gray-800"
                      : subscription.status === "CANCELLED"
                      ? "bg-red-100 text-red-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {subscription.status}
                </span>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Auto Renew</p>
                <p className="text-sm font-medium text-[var(--text-strong)]">
                  {subscription.autoRenew ? "Enabled" : "Disabled"}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Start Date</p>
                <p className="text-sm font-medium text-[var(--text-strong)]">{formatDate(subscription.startDate)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">End Date</p>
                <p className="text-sm font-medium text-[var(--text-strong)]">{formatDate(subscription.endDate)}</p>
              </div>
            </div>
          </div>

          {/* Usage Card */}
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
            <h3 className="text-sm font-semibold text-[var(--text-strong)] mb-4">Usage</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Washes Used</p>
                  <p className="text-sm font-bold text-[var(--text-strong)]">{subscription.washesUsed}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Remaining</p>
                  <p className="text-sm font-bold text-emerald-600">{subscription.washesRemaining}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Card */}
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 p-2">
                <CreditCard className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--text-strong)]">Payment</h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Amount Paid</p>
                <p className="text-lg font-bold text-[var(--text-strong)]">{formatCurrency(subscription.pricePaidCents)}</p>
              </div>
              {subscription.paymentId && (
                <div>
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Payment ID</p>
                  <p className="text-xs font-mono text-[var(--text-medium)] break-all">{subscription.paymentId}</p>
                </div>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
            <h3 className="text-sm font-semibold text-[var(--text-strong)] mb-4">Metadata</h3>
            <div className="space-y-3 text-xs">
              <div>
                <p className="text-[var(--text-muted)] uppercase tracking-wider mb-1">Created</p>
                <p className="text-[var(--text-medium)]">{formatDateTime(subscription.createdAt)}</p>
              </div>
              <div>
                <p className="text-[var(--text-muted)] uppercase tracking-wider mb-1">Last Updated</p>
                <p className="text-[var(--text-medium)]">{formatDateTime(subscription.updatedAt)}</p>
              </div>
              {subscription.cancelledAt && (
                <>
                  <div>
                    <p className="text-[var(--text-muted)] uppercase tracking-wider mb-1">Cancelled</p>
                    <p className="text-[var(--text-medium)]">{formatDateTime(subscription.cancelledAt)}</p>
                  </div>
                  {subscription.cancellationReason && (
                    <div>
                      <p className="text-[var(--text-muted)] uppercase tracking-wider mb-1">Reason</p>
                      <p className="text-[var(--text-medium)]">{subscription.cancellationReason}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type DriverSelectProps = {
  initialDriverId: string | null;
};

async function DriverSelect({ initialDriverId }: DriverSelectProps) {
  const drivers = await prisma.user.findMany({
    where: { role: "DRIVER" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  return (
    <div className="space-y-2 text-sm mt-3">
      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-[var(--text-strong)]">Assign full schedule to driver</span>
        <select
          name="driverId"
          defaultValue={initialDriverId ?? ""}
          className="rounded-lg border border-[var(--card-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
        >
          <option value="">Unassigned</option>
          {drivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.name || driver.email || "Driver"}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)]"
      >
        Save assignment
      </button>
    </div>
  );
}
