import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ServiceForm from "../ServiceForm";
import { updateService, deleteService } from "../actions";
import DeleteServiceButton from "../DeleteServiceButton";

export const dynamic = "force-dynamic";

type ServiceTypeAttribute = {
  name: string;
  type: "text" | "select" | "checkbox";
  options?: string[];
  required?: boolean;
};

type EditServicePageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditServicePage({ params }: EditServicePageProps) {
  const { id } = await params;

  const [service, serviceTypes] = await Promise.all([
    prisma.service.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        durationMin: true,
        priceCents: true,
        active: true,
        discountPercentage: true,
        imageUrl: true,
        carTypes: true,
        serviceTypeId: true,
        attributeValues: true,
      },
    }),
    prisma.serviceType.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, color: true, attributes: true },
    }),
  ]);

  if (!service) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Edit service</h1>
          <p className="text-sm text-[var(--text-muted)]">Update details and availability for this package.</p>
        </div>
        <DeleteServiceButton
          id={service.id}
          name={service.name}
          action={deleteService}
          redirectTo="/admin/services"
        />
      </header>

      <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-sm">
        <ServiceForm
          action={updateService}
          submitLabel="Save changes"
          cancelHref="/admin/services"
          serviceTypes={serviceTypes.map((st: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
            ...st,
            attributes: st.attributes as ServiceTypeAttribute[] | null,
          }))}
          values={{
            id: service.id,
            name: service.name,
            description: service.description,
            durationMin: service.durationMin,
            priceCents: service.priceCents,
            active: service.active,
            discountPercentage: service.discountPercentage ?? undefined,
            imageUrl: service.imageUrl,
            carTypes: service.carTypes ?? [],
            serviceTypeId: service.serviceTypeId,
            attributeValues: service.attributeValues as Record<string, string | string[]> | null,
          }}
        />
      </div>
    </div>
  );
}
