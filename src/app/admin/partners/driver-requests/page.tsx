import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type StatusFilter = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

async function loadDriverRequests(statusFilter: StatusFilter) {
  await requireAdminSession();

  const where =
    statusFilter === "ALL"
      ? {}
      : { status: statusFilter };

  const requests = await prisma.partnerDriverRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      mobileNumber: true,
      visaIssueDate: true,
      visaExpiryDate: true,
      documentType: true,
      labourCardFileName: true,
      labourCardFileType: true,
      emiratesIdFrontName: true,
      emiratesIdFrontType: true,
      emiratesIdBackName: true,
      emiratesIdBackType: true,
      status: true,
      rejectionReason: true,
      createdAt: true,
      processedAt: true,
      partner: {
        select: {
          id: true,
          name: true,
        },
      },
      processedBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  type RawRequest = typeof requests[number];

  return requests.map((request: RawRequest) => ({
    ...request,
    createdAtIso: request.createdAt.toISOString(),
    processedAtIso: request.processedAt ? request.processedAt.toISOString() : null,
    visaIssueDateIso: request.visaIssueDate ? request.visaIssueDate.toISOString() : null,
    visaExpiryDateIso: request.visaExpiryDate ? request.visaExpiryDate.toISOString() : null,
  }));
}

type AttributeValues = Record<string, string | string[]>;

async function loadServiceRequests(statusFilter: StatusFilter) {
  await requireAdminSession();

  const where =
    statusFilter === "ALL"
      ? {}
      : { status: statusFilter };

  const requests = await prisma.partnerServiceRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      carType: true,
      priceCents: true,
      durationMin: true,
      status: true,
      rejectionReason: true,
      createdAt: true,
      processedAt: true,
      serviceTypeId: true,
      attributeValues: true,
      serviceType: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
      partner: {
        select: {
          id: true,
          name: true,
        },
      },
      processedBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  type RawServiceRequest = typeof requests[number];

  return requests.map((request: RawServiceRequest) => ({
    ...request,
    attributeValues: (request.attributeValues as AttributeValues | null) ?? null,
    createdAtIso: request.createdAt.toISOString(),
    processedAtIso: request.processedAt ? request.processedAt.toISOString() : null,
  }));
}

type DriverRequestRecord = Awaited<ReturnType<typeof loadDriverRequests>>[number];
type ServiceRequestRecord = Awaited<ReturnType<typeof loadServiceRequests>>[number];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-amber-500/15 text-amber-700",
    APPROVED: "bg-emerald-500/15 text-emerald-700",
    REJECTED: "bg-rose-500/15 text-rose-700",
  };
  const label = status
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");

  return <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${styles[status] ?? "bg-slate-200"}`}>{label}</span>;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function AttributeSummary({ values }: { values: AttributeValues | null }) {
  if (!values || Object.keys(values).length === 0) {
    return null;
  }

  return (
    <div className="mt-2 space-y-1 text-[11px] text-[var(--text-muted)]">
      {Object.entries(values).map(([key, rawValue]) => {
        const value = Array.isArray(rawValue) ? rawValue.join(", ") : rawValue;
        return (
          <div key={key} className="flex flex-wrap gap-1">
            <span className="font-semibold text-[var(--text-label)]">{key}:</span>
            <span>{value}</span>
          </div>
        );
      })}
    </div>
  );
}

export default async function DriverRequestsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = searchParams ? await searchParams : {};
  const successMessage = typeof search.success === "string" ? search.success : null;
  const errorMessage = typeof search.error === "string" ? search.error : null;

  const rawStatus = typeof search.status === "string" ? search.status.toUpperCase() : "PENDING";
  const allowed: StatusFilter[] = ["PENDING", "APPROVED", "REJECTED", "ALL"];
  const statusFilter: StatusFilter = allowed.includes(rawStatus as StatusFilter)
    ? (rawStatus as StatusFilter)
    : "PENDING";

  const driverRequests = await loadDriverRequests(statusFilter);
  const serviceRequests = await loadServiceRequests(statusFilter);

  const statusTabs: { value: StatusFilter; label: string }[] = [
    { value: "PENDING", label: "Pending" },
    { value: "APPROVED", label: "Approved" },
    { value: "REJECTED", label: "Rejected" },
    { value: "ALL", label: "All" },
  ];

  const buildStatusHref = (value: StatusFilter) => {
    const lower = value.toLowerCase();
    return value === "PENDING" ? "/admin/partners/driver-requests" : `/admin/partners/driver-requests?status=${lower}`;
  };

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--brand-primary)]">Partner management</p>
          <h1 className="text-3xl font-semibold text-[var(--text-strong)]">Change requests</h1>
          <p className="text-sm text-[var(--text-muted)]">Review and approve driver and service changes submitted by partners.</p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-secondary)] px-1 py-1 text-xs">
          {statusTabs.map((tab) => {
            const isActive = statusFilter === tab.value;
            return (
              <Link
                key={tab.value}
                href={buildStatusHref(tab.value)}
                className={`rounded-full px-3 py-1 font-medium transition-colors ${
                  isActive
                    ? "bg-[var(--brand-primary)] text-white"
                    : "text-[var(--text-medium)] hover:bg-[var(--surface-border)]/60 hover:text-[var(--text-strong)]"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </header>

      {successMessage ? (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">{successMessage}</div>
      ) : null}
      {errorMessage ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>
      ) : null}

      <div className="space-y-4">
        {/* Driver requests */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--text-strong)]">Driver approval requests</h2>
          {driverRequests.length === 0 ? (
            <div className="rounded-2xl border border-[var(--surface-border)] bg-white px-6 py-8 text-center text-sm text-[var(--text-muted)]">
              No driver approval requests for this filter.
            </div>
          ) : (
            driverRequests.map((request: DriverRequestRecord) => (
              <article
                key={request.id}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--surface-border)] bg-white px-6 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.3em] text-black">Driver approval request</p>
                  <div className="flex flex-wrap gap-3 text-sm text-black/60">
                    <span>Submitted {formatDate(request.createdAtIso)}</span>
                    <span>•</span>
                    <span>
                      Company:
                      <Link
                        href={`/admin/partners/${request.partner.id}`}
                        className="ml-2 text-black/70 underline decoration-solid hover:text-black"
                      >
                        {request.partner.name}
                      </Link>
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 text-sm text-black sm:items-end">
                  <StatusBadge status={request.status} />
                  <Link
                    href={`/admin/partners/driver-requests/${request.id}`}
                    className="inline-flex items-center justify-center rounded-full border border-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-[var(--brand-primary)] transition hover:bg-[var(--brand-primary)] hover:text-white"
                  >
                    View request
                  </Link>
                </div>
              </article>
            ))
          )}
        </section>

        {/* Service requests */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--text-strong)]">Service approval requests</h2>
          {serviceRequests.length === 0 ? (
            <div className="rounded-2xl border border-[var(--surface-border)] bg-white px-6 py-8 text-center text-sm text-[var(--text-muted)]">
              No service approval requests for this filter.
            </div>
          ) : (
            serviceRequests.map((request: ServiceRequestRecord) => (
              <article
                key={request.id}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--surface-border)] bg-white px-6 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.3em] text-black">Service approval request</p>
                  <div className="flex flex-wrap gap-3 text-sm text-black/60">
                    <span>Submitted {formatDate(request.createdAtIso)}</span>
                    <span>•</span>
                    <span>
                      Company:
                      <Link
                        href={`/admin/partners/${request.partner.id}`}
                        className="ml-2 text-black/70 underline decoration-solid hover:text-black"
                      >
                        {request.partner.name}
                      </Link>
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--text-strong)]">
                    <span>{request.name}</span>
                    <span className="text-xs text-[var(--text-muted)]">({request.carType})</span>
                    {request.serviceType?.name ? (
                      <span className="inline-flex items-center rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                        {request.serviceType.name}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {request.durationMin} min • {new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format((request.priceCents ?? 0) / 100)}
                  </div>
                  <AttributeSummary values={(request.attributeValues as Record<string, string | string[]>) ?? null} />
                  {request.imageUrl ? (
                    <div className="text-xs">
                      <a
                        href={request.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--brand-primary)] underline"
                      >
                        View image
                      </a>
                    </div>
                  ) : null}
                  {request.rejectionReason ? (
                    <div className="text-xs text-rose-700">Reason: {request.rejectionReason}</div>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2 text-sm text-black sm:items-end">
                  <StatusBadge status={request.status} />
                  <div className="flex flex-wrap justify-end gap-2">
                    <Link
                      href={`/admin/partners/service-requests/${request.id}`}
                      className="inline-flex items-center justify-center rounded-full border border-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-[var(--brand-primary)] transition hover:bg-[var(--brand-primary)] hover:text-white"
                    >
                      View & edit
                    </Link>
                    <Link
                      href={`/admin/partners/${request.partner.id}`}
                      className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-4 py-2 text-xs font-semibold text-[var(--text-medium)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                    >
                      View partner
                    </Link>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
