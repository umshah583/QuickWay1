import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import AttributesForm from "./AttributesForm";

export const dynamic = "force-dynamic";

type ServiceTypeAttribute = {
  name: string;
  type: "text" | "select" | "checkbox";
  options?: string[];
  required?: boolean;
};

type PageProps = {
  params: Promise<{ typeId: string }>;
};

export default async function ServiceTypeAttributesPage({ params }: PageProps) {
  const { typeId } = await params;

  const serviceType = await prisma.serviceType.findUnique({
    where: { id: typeId, active: true },
    select: {
      id: true,
      name: true,
      description: true,
      icon: true,
      color: true,
      attributes: true,
    },
  });

  if (!serviceType) {
    notFound();
  }

  const attributes = (serviceType.attributes as ServiceTypeAttribute[]) ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-3xl"
          style={{ backgroundColor: `${serviceType.color || "#3B82F6"}20` }}
        >
          {serviceType.icon || "🔧"}
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-strong)]">{serviceType.name}</h1>
        {serviceType.description && (
          <p className="text-[var(--text-muted)]">{serviceType.description}</p>
        )}
      </div>

      {/* Attributes form or skip to providers */}
      <AttributesForm 
        serviceTypeId={serviceType.id} 
        serviceTypeName={serviceType.name}
        attributes={attributes} 
      />
    </div>
  );
}
