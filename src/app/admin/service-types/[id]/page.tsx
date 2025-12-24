import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import ServiceTypeForm from "../ServiceTypeForm";
import { updateServiceType } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditServiceTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const serviceType = await prisma.serviceType.findUnique({
    where: { id },
  });

  if (!serviceType) {
    notFound();
  }

  async function handleUpdate(formData: FormData) {
    "use server";
    await updateServiceType(formData);
    redirect("/admin/service-types");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Edit Service Type</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Update {serviceType.name}
        </p>
      </div>

      <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-6">
        <ServiceTypeForm
          action={handleUpdate}
          values={{
            id: serviceType.id,
            name: serviceType.name,
            description: serviceType.description,
            icon: serviceType.icon,
            color: serviceType.color,
            active: serviceType.active,
            sortOrder: serviceType.sortOrder,
            attributes: (serviceType.attributes as Array<{ name: string; type: "text" | "select" | "checkbox"; options?: string[]; required?: boolean }>) ?? [],
          }}
          submitLabel="Update Service Type"
          cancelHref="/admin/service-types"
        />
      </div>
    </div>
  );
}
