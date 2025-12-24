import { prisma } from "@/lib/prisma";
import ServiceForm from "../ServiceForm";
import { createService } from "../actions";

export const dynamic = "force-dynamic";

type ServiceTypeAttribute = {
  name: string;
  type: "text" | "select" | "checkbox";
  options?: string[];
  required?: boolean;
};

type ServiceType = {
  id: string;
  name: string;
  color: string | null;
  attributes?: ServiceTypeAttribute[] | null;
};

export default async function NewServicePage() {
  const serviceTypes = await prisma.serviceType.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, color: true, attributes: true },
  });

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Add service</h1>
        <p className="text-sm text-[var(--text-muted)]">Define a new package with pricing, duration, and availability.</p>
      </header>

      <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-sm">
        <ServiceForm 
          action={createService} 
          submitLabel="Create service" 
          cancelHref="/admin/services"
          serviceTypes={serviceTypes.map((st: any) => ({
            ...st,
            attributes: st.attributes as ServiceTypeAttribute[] | null,
          }))}
        />
      </div>
    </div>
  );
}
