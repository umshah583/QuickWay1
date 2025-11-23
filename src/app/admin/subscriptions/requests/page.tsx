/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { Calendar, Package, User, MapPin, Car, Clock, CheckCircle } from "lucide-react";
import { approveSubscriptionRequest, rejectSubscriptionRequest } from "./actions";

export const dynamic = "force-dynamic";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-AE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

type PrismaWithRequests = typeof prisma & {
  subscriptionRequest: {
    findMany: (args: unknown) => Promise<any[]>;
  };
};

const requestsDb = prisma as PrismaWithRequests;

export default async function SubscriptionRequestsPage() {
  const requests = await requestsDb.subscriptionRequest.findMany({
    where: {
      status: { in: ["PENDING", "APPROVED"] },
    },
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
          description: true,
          priceCents: true,
          washesPerMonth: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  const approvedRequests = requests.filter((r) => r.status === "APPROVED");

  return (
    <div className="min-h-screen bg-[var(--surface-primary)] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-strong)] mb-2">
            Subscription Requests
          </h1>
          <p className="text-[var(--text-muted)]">
            Review and approve customer subscription applications
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-500/10 p-3">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-strong)]">{pendingRequests.length}</p>
                <p className="text-sm text-[var(--text-muted)]">Pending Approval</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/10 p-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-strong)]">{approvedRequests.length}</p>
                <p className="text-sm text-[var(--text-muted)]">Awaiting Payment</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-3">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-strong)]">{requests.length}</p>
                <p className="text-sm text-[var(--text-muted)]">Total Active Requests</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-[var(--text-strong)] mb-4">
              ⏳ Pending Approval ({pendingRequests.length})
            </h2>
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <RequestCard key={request.id} request={request} />
              ))}
            </div>
          </div>
        )}

        {/* Approved Requests (Awaiting Payment) */}
        {approvedRequests.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-[var(--text-strong)] mb-4">
              ✅ Approved - Awaiting Payment ({approvedRequests.length})
            </h2>
            <div className="space-y-4">
              {approvedRequests.map((request) => (
                <RequestCard key={request.id} request={request} />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {requests.length === 0 && (
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-12 text-center">
            <Package className="h-16 w-16 text-[var(--text-muted)] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[var(--text-strong)] mb-2">
              No subscription requests
            </h3>
            <p className="text-sm text-[var(--text-muted)]">
              Customer subscription requests will appear here for approval
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function RequestCard({ request }: { request: any }) {
  const isPending = request.status === "PENDING";
  const scheduleDates = (request.scheduleDates || []).map((d: string) => new Date(d));

  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 p-3">
            <User className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-strong)]">
              {request.user.name || "Unknown Customer"}
            </h3>
            <p className="text-sm text-[var(--text-muted)]">{request.user.email}</p>
            {request.user.phoneNumber && (
              <p className="text-sm text-[var(--text-muted)]">{request.user.phoneNumber}</p>
            )}
          </div>
        </div>
        <div>
          {isPending ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">
              <Clock className="h-3 w-3" />
              Pending
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
              <CheckCircle className="h-3 w-3" />
              Approved
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Package Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-[var(--text-muted)]" />
            <span className="text-sm font-semibold text-[var(--text-strong)]">Package Details</span>
          </div>
          <div className="pl-7 space-y-1">
            <p className="text-base font-bold text-[var(--text-strong)]">{request.package.name}</p>
            <p className="text-sm text-[var(--text-muted)]">{request.package.description}</p>
            <p className="text-lg font-bold text-[var(--brand-primary)]">
              {formatCurrency(request.package.priceCents)}
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              {request.package.washesPerMonth} washes/month
            </p>
          </div>
        </div>

        {/* Car & Location */}
        <div className="space-y-3">
          {(request.vehicleMake || request.vehicleModel) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Car className="h-5 w-5 text-[var(--text-muted)]" />
                <span className="text-sm font-semibold text-[var(--text-strong)]">Vehicle</span>
              </div>
              <div className="pl-7 space-y-1">
                <p className="text-sm text-[var(--text-strong)]">
                  {request.vehicleColor} {request.vehicleMake} {request.vehicleModel}
                </p>
                {request.vehicleType && (
                  <p className="text-xs text-[var(--text-muted)]">Type: {request.vehicleType}</p>
                )}
                {request.vehiclePlate && (
                  <p className="text-xs text-[var(--text-muted)]">Plate: {request.vehiclePlate}</p>
                )}
              </div>
            </div>
          )}
          {request.locationLabel && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-5 w-5 text-[var(--text-muted)]" />
                <span className="text-sm font-semibold text-[var(--text-strong)]">Location</span>
              </div>
              <div className="pl-7">
                <p className="text-sm text-[var(--text-strong)]">{request.locationLabel}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Schedule */}
      {scheduleDates.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-5 w-5 text-[var(--text-muted)]" />
            <span className="text-sm font-semibold text-[var(--text-strong)]">
              Wash Schedule ({scheduleDates.length} days selected)
            </span>
          </div>
          <div className="pl-7 flex flex-wrap gap-2">
            {scheduleDates.slice(0, 10).map((date: Date, idx: number) => (
              <div
                key={idx}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-secondary)] px-3 py-1 text-xs font-medium text-[var(--text-strong)]"
              >
                {new Intl.DateTimeFormat("en-AE", { month: "short", day: "numeric" }).format(date)}
              </div>
            ))}
            {scheduleDates.length > 10 && (
              <span className="text-xs text-[var(--text-muted)] self-center">
                +{scheduleDates.length - 10} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="text-xs text-[var(--text-muted)] mb-4 border-t border-[var(--surface-border)] pt-4">
        <p>Request ID: {request.id}</p>
        <p>Submitted: {formatDate(request.createdAt)}</p>
        {request.approvedAt && <p>Approved: {formatDate(request.approvedAt)}</p>}
      </div>

      {/* Actions */}
      {isPending && (
        <div className="flex items-center gap-3">
          <form action={approveSubscriptionRequest} className="flex-1">
            <input type="hidden" name="requestId" value={request.id} />
            <button
              type="submit"
              className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              ✅ Approve Request
            </button>
          </form>
          <RejectForm requestId={request.id} />
        </div>
      )}
    </div>
  );
}

function RejectForm({ requestId }: { requestId: string }) {
  return (
    <details className="flex-1">
      <summary className="w-full cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 text-center">
        ❌ Reject
      </summary>
      <form action={rejectSubscriptionRequest} className="mt-2 space-y-2">
        <input type="hidden" name="requestId" value={requestId} />
        <textarea
          name="rejectionReason"
          placeholder="Enter rejection reason..."
          required
          rows={3}
          className="w-full rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
        />
        <button
          type="submit"
          className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          Confirm Rejection
        </button>
      </form>
    </details>
  );
}
