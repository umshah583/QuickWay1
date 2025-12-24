import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { updateServiceRequest, approveServiceRequest, rejectServiceRequest } from "../actions";
import { PARTNER_SERVICE_CAR_TYPES, type PartnerServiceCarType } from "@/app/partner/services/carTypes";

function formatStatus(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function statusStyles(status: string) {
  const map: Record<string, string> = {
    PENDING: "bg-amber-500/15 text-amber-700",
    APPROVED: "bg-emerald-500/15 text-emerald-700",
    REJECTED: "bg-rose-500/15 text-rose-700",
  };
  return map[status] ?? "bg-slate-200 text-slate-600";
}

function formatCurrency(cents: number | null | undefined) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format((cents ?? 0) / 100);
}

export default async function ServiceRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminSession();

  const [request, serviceTypes] = await Promise.all([
    prisma.partnerServiceRequest.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        durationMin: true,
        priceCents: true,
        carType: true,
        serviceTypeId: true,
        attributeValues: true,
        status: true,
        rejectionReason: true,
        createdAt: true,
        processedAt: true,
        serviceType: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        partner: { select: { id: true, name: true } },
        processedBy: { select: { name: true, email: true } },
      },
    }),
    prisma.serviceType.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
      },
    }),
  ]);

  if (!request) {
    notFound();
  }

  const createdAt = request.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  const processedAt = request.processedAt
    ? request.processedAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
    : null;

  const isPending = request.status === "PENDING";
  const canEdit = request.status !== "REJECTED";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--brand-primary)]">Service request</p>
          <h1 className="text-3xl font-semibold text-[var(--text-strong)]">{request.name}</h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-black/60">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] px-3 py-1">
              <span
                className={`h-2 w-2 rounded-full ${
                  request.status === "PENDING" ? "bg-amber-500" : request.status === "APPROVED" ? "bg-emerald-500" : "bg-rose-500"
                }`}
              />
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusStyles(request.status)}`}>
                {formatStatus(request.status)}
              </span>
            </span>
            <span className="rounded-full border border-[var(--surface-border)] px-3 py-1">Submitted {createdAt}</span>
            {request.serviceType?.name ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] px-3 py-1 text-[var(--text-muted)]">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: request.serviceType.color ?? "var(--brand-primary)" }} />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-label)]">
                  {request.serviceType.name}
                </span>
              </span>
            ) : null}
            <span className="rounded-full border border-[var(--surface-border)] px-3 py-1">
              Partner:
              <Link
                href={`/admin/partners/${request.partner.id}`}
                className="ml-2 underline decoration-dotted hover:text-[var(--brand-primary)]"
              >
                {request.partner.name}
              </Link>
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/admin/partners/driver-requests"
            className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-4 py-2 font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
          >
            Back to change requests
          </Link>
          {isPending ? (
            <form action={approveServiceRequest.bind(null, request.id)}>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)]"
              >
                Approve
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {/* Edit form section */}
      {canEdit ? (
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-[var(--text-strong)]">Edit service request</h2>
          <form action={updateServiceRequest.bind(null, request.id)} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text-label)]">Service name</label>
              <input
                type="text"
                name="name"
                required
                defaultValue={request.name}
                className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text-label)]">Service type</label>
              <select
                name="serviceTypeId"
                required
                defaultValue={request.serviceTypeId ?? ""}
                className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
              >
                <option value="" disabled>
                  Select service type
                </option>
                {serviceTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text-label)]">Car type</label>
              <select
                name="carType"
                required
                defaultValue={request.carType}
                className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
              >
                {PARTNER_SERVICE_CAR_TYPES.map((type: PartnerServiceCarType) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text-label)]">Duration (minutes)</label>
              <input
                type="number"
                name="durationMin"
                required
                min={1}
                defaultValue={request.durationMin}
                className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text-label)]">Base price (AED)</label>
              <input
                type="number"
                name="price"
                required
                min={0.01}
                step={0.01}
                defaultValue={(request.priceCents / 100).toFixed(2)}
                className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium text-[var(--text-label)]">Description (optional)</label>
              <textarea
                name="description"
                rows={2}
                defaultValue={request.description ?? ""}
                className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium text-[var(--text-label)]">Image URL (optional)</label>
              <input
                type="url"
                name="imageUrl"
                defaultValue={request.imageUrl ?? ""}
                className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                placeholder="https://example.com/service-image.jpg"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)]"
              >
                Save changes
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="space-y-4 rounded-2xl border border-[var(--surface-border)] bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-[var(--text-strong)]">Service details</h2>
          <dl className="grid gap-3 text-sm text-black/60">
            <div className="grid gap-1">
              <dt className="font-medium text-[var(--text-strong)]">Service type</dt>
              <dd>{request.serviceType?.name ?? "—"}</dd>
            </div>
            <div className="grid gap-1">
              <dt className="font-medium text-[var(--text-strong)]">Service name</dt>
              <dd>{request.name}</dd>
            </div>
            <div className="grid gap-1">
              <dt className="font-medium text-[var(--text-strong)]">Description</dt>
              <dd>{request.description ?? "—"}</dd>
            </div>
            <div className="grid gap-1">
              <dt className="font-medium text-[var(--text-strong)]">Duration</dt>
              <dd>{request.durationMin} minutes</dd>
            </div>
            <div className="grid gap-1">
              <dt className="font-medium text-[var(--text-strong)]">Base price</dt>
              <dd>{formatCurrency(request.priceCents)}</dd>
            </div>
            <div className="grid gap-1">
              <dt className="font-medium text-[var(--text-strong)]">Car type</dt>
              <dd>{request.carType}</dd>
            </div>
            {request.attributeValues && Object.keys(request.attributeValues as Record<string, unknown>).length > 0 ? (
              <div className="grid gap-2">
                <dt className="font-medium text-[var(--text-strong)]">Submitted attributes</dt>
                <dd className="space-y-1 text-sm text-[var(--text-muted)]">
                  {Object.entries(request.attributeValues as Record<string, string | string[]>).map(([key, rawValue]) => {
                    const value = Array.isArray(rawValue) ? rawValue.join(", ") : rawValue;
                    return (
                      <div key={key} className="flex flex-wrap gap-1">
                        <span className="text-[var(--text-strong)]">{key}:</span>
                        <span>{value}</span>
                      </div>
                    );
                  })}
                </dd>
              </div>
            ) : null}
            {request.imageUrl ? (
              <div className="grid gap-1">
                <dt className="font-medium text-[var(--text-strong)]">Image</dt>
                <dd>
                  <a
                    href={request.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--brand-primary)] underline"
                  >
                    View image
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        </article>

        <article className="space-y-4 rounded-2xl border border-[var(--surface-border)] bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-[var(--text-strong)]">Status & actions</h2>
          <dl className="grid gap-3 text-sm text-[var(--text-muted)]">
            <div className="grid gap-1">
              <dt className="font-medium text-[var(--text-strong)]">Status</dt>
              <dd>
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${statusStyles(request.status)}`}>
                  {formatStatus(request.status)}
                </span>
              </dd>
            </div>
            <div className="grid gap-1">
              <dt className="font-medium text-[var(--text-strong)]">Processed on</dt>
              <dd>{processedAt ?? "—"}</dd>
            </div>
            <div className="grid gap-1">
              <dt className="font-medium text-[var(--text-strong)]">Processed by</dt>
              <dd>{request.processedBy?.name ?? "—"}</dd>
            </div>
            <div className="grid gap-1">
              <dt className="font-medium text-[var(--text-strong)]">Rejection reason</dt>
              <dd>{request.rejectionReason ?? "—"}</dd>
            </div>
          </dl>

          {isPending ? (
            <form action={rejectServiceRequest.bind(null, request.id)} className="space-y-3">
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-[var(--text-strong)]">Reject with reason</span>
                <input
                  type="text"
                  name="reason"
                  required
                  placeholder="Reason for rejection"
                  className="rounded-lg border border-[var(--surface-border)] px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                />
              </label>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full border border-rose-500/40 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10"
              >
                Reject request
              </button>
            </form>
          ) : null}
        </article>
      </section>
    </div>
  );
}
