import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { deleteService, toggleServiceActive } from "./actions";
import DeleteServiceButton from "@/app/admin/services/DeleteServiceButton";

export const dynamic = "force-dynamic";

type ServiceListItem = Prisma.ServiceGetPayload<{
  include: {
    partnerServiceRequests: {
      include: {
        partner: true;
      };
    };
    serviceType: true;
  };
}>;

type ServicesPageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

function parseStatus(status?: string | string[]) {
  if (Array.isArray(status)) return undefined;
  if (!status) return undefined;
  const normalized = status.toLowerCase();
  if (normalized === "active" || normalized === "inactive") {
    return normalized;
  }
  return undefined;
}

function parseQuery(q?: string | string[]) {
  if (Array.isArray(q)) return q[0] ?? "";
  return q ?? "";
}

function parsePartner(value?: string | string[]) {
  if (Array.isArray(value)) return "";
  return value ?? "";
}

export default async function AdminServicesPage({
  searchParams,
}: ServicesPageProps & { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;

  const statusFilter = parseStatus(params.status);
  const searchQuery = parseQuery(params.q).trim().toLowerCase();
  const partnerFilter = parsePartner(params.partner as string | string[] | undefined);

  const allServices = await prisma.service.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      partnerServiceRequests: {
        include: {
          partner: true,
        },
      },
      serviceType: true,
    },
  });

  const partnerOptionsMap = new Map<string, string>();
  for (const service of allServices) {
    for (const req of service.partnerServiceRequests ?? []) {
      if (req.partnerId && req.partner?.name) {
        partnerOptionsMap.set(req.partnerId, req.partner.name);
      }
    }
  }
  const partnerOptions = Array.from(partnerOptionsMap.entries()).map(([id, name]) => ({ id, name }));

  const services = allServices.filter((service: ServiceListItem) => {
    const matchesStatus =
      !statusFilter || (statusFilter === "active" ? service.active : !service.active);
    const matchesQuery =
      !searchQuery ||
      service.name.toLowerCase().includes(searchQuery) ||
      (service.description?.toLowerCase().includes(searchQuery) ?? false);
    const matchesPartner =
      !partnerFilter ||
      (partnerFilter === "quickway"
        ? (service.partnerServiceRequests?.length ?? 0) === 0
        : (service.partnerServiceRequests ?? []).some((req) => req.partnerId === partnerFilter));

    return matchesStatus && matchesQuery && matchesPartner;
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Services</h1>
          <p className="text-sm text-[var(--text-muted)]">Manage offerings, durations, pricing, and status.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/service-types"
            className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-5 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
          >
            Manage Types
          </Link>
          <Link
            href="/admin/services/new"
            className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)]"
          >
            Add service
          </Link>
        </div>
      </header>

      <form
        method="get"
        className="flex flex-col gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)]/80 p-4 sm:flex-row sm:items-end sm:gap-6"
      >
        <label className="flex flex-1 flex-col gap-2 text-sm">
          <span className="font-medium text-[var(--text-strong)]">Search</span>
          <input
            type="search"
            name="q"
            defaultValue={searchQuery}
            placeholder="Search name or description"
            className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
          />
        </label>
        <label className="flex w-full flex-col gap-2 text-sm sm:w-48">
          <span className="font-medium text-[var(--text-strong)]">Status</span>
          <select
            name="status"
            defaultValue={statusFilter ?? "all"}
            className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <label className="flex w-full flex-col gap-2 text-sm sm:w-64">
          <span className="font-medium text-[var(--text-strong)]">Partner</span>
          <select
            name="partner"
            defaultValue={partnerFilter || ""}
            className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
          >
            <option value="">All</option>
            <option value="quickway">QuickWay (in-house)</option>
            {partnerOptions.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row sm:items-center sm:gap-3">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)]"
          >
            Apply
          </button>
          <Link
            href="/admin/services"
            className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-5 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
          >
            Reset
          </Link>
        </div>
      </form>

      {services.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface)]/70 p-10 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            No services found. Adjust filters or create a new service to get started.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] shadow-sm">
          <table className="min-w-full divide-y divide-[var(--surface-border)] text-sm">
            <thead className="bg-[var(--background)]/60">
              <tr className="text-left text-[var(--text-muted)]">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Duration</th>
                <th className="px-4 py-3 font-semibold">Price</th>
                <th className="px-4 py-3 font-semibold">Partner</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {services.map((service: ServiceListItem) => (
                <tr key={service.id} className="hover:bg-[var(--brand-accent)]/15 transition">
                  <td className="px-4 py-3 font-medium text-[var(--text-strong)]">{service.name}</td>
                  <td className="px-4 py-3">
                    {service.serviceType ? (
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: service.serviceType.color || '#6B7280' }}
                      >
                        {service.serviceType.name}
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{service.durationMin} min</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">${(service.priceCents / 100).toFixed(2)}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    {service.partnerServiceRequests && service.partnerServiceRequests.length > 0
                      ? Array.from(
                          new Set(
                            service.partnerServiceRequests
                              .map((req) => req.partner?.name)
                              .filter(Boolean) as string[],
                          ),
                        ).join(", ")
                      : "QuickWay"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                        service.active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {service.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    {format(service.createdAt, "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2 text-xs">
                      <form action={toggleServiceActive}>
                        <input type="hidden" name="id" value={service.id} />
                        <input type="hidden" name="active" value={service.active ? "true" : "false"} />
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-3 py-1.5 font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                        >
                          {service.active ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                      <Link
                        href={`/admin/services/${service.id}`}
                        className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-3 py-1.5 font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                      >
                        Edit
                      </Link>
                      <DeleteServiceButton
                        id={service.id}
                        name={service.name}
                        action={deleteService}
                        redirectTo="/admin/services"
                        description="Deleting this service will remove it from customer scheduling and cancel any related availability. This cannot be undone."
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
