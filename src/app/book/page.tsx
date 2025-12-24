import prisma from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

type ServiceTypeCard = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  _count: { services: number };
};

export default async function BookServiceTypesPage() {
  const serviceTypes = await prisma.serviceType.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      icon: true,
      color: true,
      _count: {
        select: { services: true },
      },
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-[var(--text-strong)]">Book a Service</h1>
        <p className="text-[var(--text-muted)]">Select the type of service you need</p>
      </div>

      {serviceTypes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[var(--text-muted)]">No service types available at the moment.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(serviceTypes as ServiceTypeCard[]).map((type) => (
            <Link
              key={type.id}
              href={`/book/${type.id}`}
              className="group relative flex flex-col items-center rounded-2xl border-2 border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-sm transition-all hover:border-[var(--brand-primary)] hover:shadow-md"
            >
              {/* Icon */}
              <div
                className="mb-4 flex h-16 w-16 items-center justify-center rounded-full text-3xl"
                style={{ backgroundColor: `${type.color || "#3B82F6"}20` }}
              >
                {type.icon || "🔧"}
              </div>

              {/* Name */}
              <h2 className="text-xl font-semibold text-[var(--text-strong)] group-hover:text-[var(--brand-primary)]">
                {type.name}
              </h2>

              {/* Description */}
              {type.description && (
                <p className="mt-2 text-center text-sm text-[var(--text-muted)] line-clamp-2">
                  {type.description}
                </p>
              )}

              {/* Services count */}
              <div className="mt-4 text-xs text-[var(--text-muted)]">
                {type._count.services} {type._count.services === 1 ? "service" : "services"} available
              </div>

              {/* Arrow indicator */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] opacity-0 transition group-hover:opacity-100">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
