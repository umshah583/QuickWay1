import { prisma } from "@/lib/prisma";
import { Plus, Edit2, Layers } from "lucide-react";
import Link from "next/link";
import DeleteServiceTypeButton from "./DeleteServiceTypeButton";

export const dynamic = "force-dynamic";

export default async function ServiceTypesPage() {
  const serviceTypes = await prisma.serviceType.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: {
        select: { services: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Service Types</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Manage service categories like Car Wash, Detailing, etc.
          </p>
        </div>
        <Link
          href="/admin/service-types/new"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)]"
        >
          <Plus className="h-4 w-4" />
          Add Service Type
        </Link>
      </div>

      {serviceTypes.length === 0 ? (
        <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-12 text-center">
          <Layers className="mx-auto h-12 w-12 text-[var(--text-muted)]" />
          <h3 className="mt-4 text-lg font-medium text-[var(--text-strong)]">No service types yet</h3>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Create service types to categorize your services
          </p>
          <Link
            href="/admin/service-types/new"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Create First Service Type
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-[var(--surface-border)] bg-[var(--surface-secondary)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                  Services
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                  Order
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {serviceTypes.map((type) => (
                <tr key={type.id} className="hover:bg-[var(--surface-secondary)]/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {type.color && (
                        <div
                          className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-sm"
                          style={{ backgroundColor: type.color }}
                        >
                          {type.icon || type.name.charAt(0)}
                        </div>
                      )}
                      <span className="text-sm font-medium text-[var(--text-strong)]">
                        {type.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text-medium)]">
                    {type.description || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                      {type._count.services} services
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        type.active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {type.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text-medium)]">
                    {type.sortOrder}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/service-types/${type.id}`}
                        className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-secondary)] hover:text-[var(--brand-primary)]"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Link>
                      <DeleteServiceTypeButton
                        id={type.id}
                        name={type.name}
                        servicesCount={type._count.services}
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
