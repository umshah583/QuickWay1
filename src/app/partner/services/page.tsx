import { requirePartnerSession } from "@/lib/partner-auth";
import prisma from "@/lib/prisma";
import { Car, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { createPartnerService } from "./actions";
import PartnerServiceAttributeFields, {
  type PartnerServiceType,
  type ServiceTypeAttribute,
} from "./PartnerServiceAttributeFields";

export const dynamic = "force-dynamic";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
  }).format((cents ?? 0) / 100);
}

export default async function PartnerServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ serviceRequest?: string; error?: string }>;
}) {
  const params = await searchParams;
  const session = await requirePartnerSession();
  const partnerUserId = session.user?.id;

  const partner = await prisma.partner.findUnique({
    where: { userId: partnerUserId },
    select: { id: true, name: true },
  });

  if (!partner) {
    return (
      <div className="px-4 py-10">
        <p className="text-sm text-rose-600">Partner profile not found.</p>
      </div>
    );
  }

  const [requests, serviceTypesRaw] = await Promise.all([
    prisma.partnerServiceRequest.findMany({
      where: { partnerId: partner.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.serviceType.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        attributes: true,
      },
    }),
  ]);

  const serviceTypes: PartnerServiceType[] = serviceTypesRaw.map((type) => ({
    id: type.id,
    name: type.name,
    color: type.color,
    attributes: (type.attributes as ServiceTypeAttribute[] | null) ?? null,
  }));

  const showSuccessBanner = params.serviceRequest === "1";
  const errorMessage = params.error ? decodeURIComponent(params.error) : null;

  return (
    <div className="space-y-6">
      {/* Success Banner */}
      {showSuccessBanner && (
        <div className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <div>
            <p className="text-sm font-medium text-green-700">Service request submitted!</p>
            <p className="text-xs text-green-600">Your new service will be available to customers once approved by admin.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[var(--text-strong)]">Services</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Create new services for your account. All services go through admin approval and use default tax/VAT rules.
          </p>
        </div>
      </div>

      {/* Create Service Form */}
      <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--brand-primary)]/10">
            <Car className="h-5 w-5 text-[var(--brand-primary)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-strong)]">Request a new service</h2>
            <p className="text-xs text-[var(--text-muted)]">
              Submit details for admin review. Approved services will automatically use platform tax, VAT, and pricing rules.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs text-rose-700">
            {errorMessage}
          </div>
        )}

        <form action={createPartnerService} className="mt-2 grid gap-4 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-[var(--text-label)]">Service name</label>
            <input
              type="text"
              name="name"
              required
              className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
              placeholder="e.g. Premium Exterior Wash"
            />
          </div>

          <PartnerServiceAttributeFields serviceTypes={serviceTypes} />

          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-label)]">Duration (minutes)</label>
            <input
              type="number"
              name="durationMin"
              min={10}
              step={5}
              required
              className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
              placeholder="e.g. 45"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-[var(--text-label)]">Image URL (optional)</label>
            <input
              type="url"
              name="imageUrl"
              className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
              placeholder="https://example.com/service-image.jpg"
            />
            <p className="text-[10px] text-[var(--text-muted)]">Provide a link to an image that represents this service (optional).</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-label)]">Base price (AED)</label>
            <input
              type="number"
              name="price"
              min={1}
              step="0.5"
              required
              className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
              placeholder="e.g. 45"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-[var(--text-label)]">Description (optional)</label>
            <textarea
              name="description"
              rows={3}
              className="w-full resize-none rounded-lg border border-[var(--surface-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
              placeholder="Describe what is included in this service so admins and customers can understand it."
            />
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-primary)]/90"
            >
              Submit for approval
            </button>
          </div>
        </form>
      </div>

      {/* Existing service requests */}
      <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-strong)]">Your service requests</h2>
            <p className="text-xs text-[var(--text-muted)]">Track the status of services waiting for admin approval.</p>
          </div>
        </div>

        {requests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--surface-border)] bg-[var(--background)]/60 px-6 py-10 text-center text-sm text-[var(--text-muted)]">
            You have not submitted any service requests yet. Use the form above to create your first service.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--surface-border)] bg-[var(--surface-secondary)]/40">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--surface-secondary)] text-[var(--text-muted)]">
                <tr className="text-xs uppercase tracking-[0.16em]">
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Image</th>
                  <th className="px-4 py-3">Car type</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Processed</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)] bg-[var(--surface)]">
                {requests.map((request: (typeof requests)[number]) => {
                  const submittedAt = format(new Date(request.createdAt), "d MMM yyyy, h:mma");
                  const processedAt = request.processedAt ? format(new Date(request.processedAt), "d MMM yyyy, h:mma") : "—";
                  const statusLabel = request.status.toLowerCase().replace(/_/g, " ");
                  const statusClass =
                    request.status === "APPROVED"
                      ? "bg-emerald-500/10 text-emerald-700"
                      : request.status === "REJECTED"
                        ? "bg-rose-500/10 text-rose-700"
                        : "bg-amber-500/10 text-amber-700";

                  return (
                    <tr key={request.id} className="hover:bg-[var(--hover-bg)]/60">
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <p className="font-semibold text-[var(--text-strong)]">{request.name}</p>
                          {request.description ? (
                            <p className="text-xs text-[var(--text-muted)] line-clamp-2">{request.description}</p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                        {request.imageUrl ? (
                          <a
                            href={request.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[var(--brand-primary)] underline"
                          >
                            View
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text-medium)]">{request.carType}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-[var(--text-strong)]">
                        {formatCurrency(request.priceCents)}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text-medium)]">{request.durationMin} min</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{submittedAt}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{processedAt}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                        {request.rejectionReason ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
