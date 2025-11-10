import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function loadRequests() {
  await requireAdminSession();

  const requests = await prisma.partnerDriverRequest.findMany({
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

type DriverRequestRecord = Awaited<ReturnType<typeof loadRequests>>[number];

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

export default async function DriverRequestsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const requests = await loadRequests();

  const search = searchParams ? await searchParams : {};
  const successMessage = typeof search.success === "string" ? search.success : null;
  const errorMessage = typeof search.error === "string" ? search.error : null;

  if (!requests) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--brand-primary)]">Partner management</p>
        <h1 className="text-3xl font-semibold text-[var(--text-strong)]">Driver approval requests</h1>
        <p className="text-sm text-[var(--text-muted)]">Approve or reject driver accounts submitted by partner organisations.</p>
      </header>

      {successMessage ? (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">{successMessage}</div>
      ) : null}
      {errorMessage ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>
      ) : null}

      <div className="space-y-4">
        {requests.length === 0 ? (
          <div className="rounded-2xl border border-[var(--surface-border)] bg-white px-6 py-12 text-center text-sm text-[var(--text-muted)]">
            No driver approval requests yet.
          </div>
        ) : null}

        {requests.map((request: DriverRequestRecord) => (
          <article key={request.id} className="flex flex-col gap-3 rounded-2xl border border-[var(--surface-border)] bg-white px-6 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.3em] text-black">Driver approval request</p>
              <div className="flex flex-wrap gap-3 text-sm text-black/20">
                <span>Submitted {formatDate(request.createdAtIso)}</span>
                <span>•</span>
                <span>
                  Company:
                  <Link href={`/admin/partners/${request.partner.id}`} className="ml-2 text-black/20 underline decoration-solid hover:text-black">
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
        ))}
      </div>
    </div>
  );
}
