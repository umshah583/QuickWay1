import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { approveDriverRequest, rejectDriverRequest } from "../actions";
import DocumentViewer, { type DocumentItem } from "./DocumentViewer";

function formatStatus(status: string) {
  return status
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

export default async function DriverRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminSession();

  const request = await prisma.partnerDriverRequest.findUnique({
    where: { id },
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

  if (!request) {
    notFound();
  }

  const createdAt = request.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  const processedAt = request.processedAt
    ? request.processedAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
    : null;
  const visaWindow = request.visaIssueDate && request.visaExpiryDate
    ? `${request.visaIssueDate.toLocaleDateString("en-GB")} → ${request.visaExpiryDate.toLocaleDateString("en-GB")}`
    : "—";

  const documents: DocumentItem[] = [];

  if (request.documentType === "LABOUR_CARD" && request.labourCardFileName) {
    documents.push({
      label: `Labour card (${request.labourCardFileType?.split("/").pop()?.toUpperCase() ?? "FILE"})`,
      href: `/admin/partners/driver-requests/${id}/documents/labour-card`,
    });
  }

  if (request.documentType === "EMIRATES_ID") {
    if (request.emiratesIdFrontName) {
      documents.push({
        label: "Emirates ID (front)",
        href: `/admin/partners/driver-requests/${id}/documents/emirates-id-front`,
      });
    }
    if (request.emiratesIdBackName) {
      documents.push({
        label: "Emirates ID (back)",
        href: `/admin/partners/driver-requests/${id}/documents/emirates-id-back`,
      });
    }
  }

  const documentTypeLabel = formatStatus(request.documentType);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--brand-primary)]">Driver request</p>
          <h1 className="text-3xl font-semibold text-[var(--text-strong)]">{request.name}</h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-black/60">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] px-3 py-1">
              <span className={`h-2 w-2 rounded-full ${request.status === "PENDING" ? "bg-amber-500" : request.status === "APPROVED" ? "bg-emerald-500" : "bg-rose-500"}`} />
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusStyles(request.status)}`}>{formatStatus(request.status)}</span>
            </span>
            <span className="rounded-full border border-[var(--surface-border)] px-3 py-1">Submitted {createdAt}</span>
            <span className="rounded-full border border-[var(--surface-border)] px-3 py-1">
              Partner:
              <Link href={`/admin/partners/${request.partner.id}`} className="ml-2 underline decoration-dotted hover:text-[var(--brand-primary)]">
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
            Back to requests
          </Link>
          {request.status === "PENDING" ? (
            <form action={approveDriverRequest.bind(null, request.id)}>
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

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="space-y-4 rounded-2xl border border-[var(--surface-border)] bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-[var(--text-strong)]">Driver information</h2>
          <dl className="grid gap-3 text-sm text-black/60">
            <div className="grid gap-1">
              <dt className="font-medium text-[var(--text-strong)]">Full name</dt>
              <dd>{request.name}</dd>
            </div>
            <div className="grid gap-1">
              <dt className="font-medium text-[var(--text-strong)]">Email</dt>
              <dd>{request.email}</dd>
            </div>
            <div className="grid gap-1">
              <dt className="font-medium text-[var(--text-strong)]">Mobile number</dt>
              <dd>{request.mobileNumber || "—"}</dd>
            </div>
            <div className="grid gap-1">
              <dt className="font-medium text-[var(--text-strong)]">Visa window</dt>
              <dd>{visaWindow}</dd>
            </div>
            <div className="grid gap-1">
              <dt className="font-medium text-[var(--text-strong)]">Document type</dt>
              <dd>{documentTypeLabel}</dd>
            </div>
          </dl>
        </article>

        <article className="space-y-4 rounded-2xl border border-[var(--surface-border)] bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-[var(--text-strong)]">Status & notes</h2>
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

          {request.status === "PENDING" ? (
            <form action={rejectDriverRequest.bind(null, request.id)} className="space-y-3">
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

      <section className="space-y-4 rounded-2xl border border-[var(--surface-border)] bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--text-strong)]">Supporting documents</h2>
        <DocumentViewer documents={documents} />
      </section>
    </div>
  );
}
