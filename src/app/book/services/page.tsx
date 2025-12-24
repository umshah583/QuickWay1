import prisma from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { applyFeesToPrice, calculateDiscountedPrice } from "@/lib/pricing";
import { loadPricingAdjustmentConfig } from "@/lib/pricingSettings";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ typeId?: string; attributes?: string }>;
};

export default async function ServicesSelectionPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const typeId = params.typeId;
  const attributesJson = params.attributes;

  if (!typeId) {
    notFound();
  }

  // Fetch service type details
  const serviceType = await prisma.serviceType.findUnique({
    where: { id: typeId, active: true },
    select: {
      id: true,
      name: true,
      icon: true,
      color: true,
    },
  });

  if (!serviceType) {
    notFound();
  }

  // Fetch services of this type
  const [services, pricingAdjustments] = await Promise.all([
    prisma.service.findMany({
      where: {
        active: true,
        serviceTypeId: typeId,
      },
      orderBy: { priceCents: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        durationMin: true,
        priceCents: true,
        discountPercentage: true,
        imageUrl: true,
        attributeValues: true,
      },
    }),
    loadPricingAdjustmentConfig(),
  ]);

  const formatter = new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" });

  // Parse selected attributes
  let selectedAttributes: Record<string, string | string[]> = {};
  if (attributesJson) {
    try {
      selectedAttributes = JSON.parse(attributesJson);
    } catch {
      // Ignore parse errors
    }
  }

  // Build booking URL with attributes
  const buildBookingUrl = (serviceId: string) => {
    const bookingParams = new URLSearchParams();
    bookingParams.set("service", serviceId);
    if (attributesJson) {
      bookingParams.set("attributes", attributesJson);
    }
    return `/booking?${bookingParams.toString()}`;
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link href="/book" className="hover:text-[var(--brand-primary)]">
          Service Types
        </Link>
        <span>/</span>
        <Link href={`/book/${typeId}`} className="hover:text-[var(--brand-primary)]">
          {serviceType.name}
        </Link>
        <span>/</span>
        <span className="text-[var(--text-strong)]">Services</span>
      </div>

      {/* Header */}
      <div className="text-center space-y-2">
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full text-2xl"
          style={{ backgroundColor: `${serviceType.color || "#3B82F6"}20` }}
        >
          {serviceType.icon || "🔧"}
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-strong)]">Select a Service</h1>
        <p className="text-[var(--text-muted)]">Choose a {serviceType.name} service to book</p>
      </div>

      {/* Selected attributes summary */}
      {Object.keys(selectedAttributes).length > 0 && (
        <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-secondary)] p-4">
          <p className="text-sm font-medium text-[var(--text-strong)] mb-2">Your Preferences:</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(selectedAttributes).map(([key, value]) => (
              <span
                key={key}
                className="inline-flex items-center rounded-full bg-[var(--brand-primary)]/10 px-3 py-1 text-xs font-medium text-[var(--brand-primary)]"
              >
                {key}: {Array.isArray(value) ? value.join(", ") : value}
              </span>
            ))}
          </div>
        </div>
      )}

      {services.length === 0 ? (
        <div className="text-center py-12 space-y-4">
          <p className="text-[var(--text-muted)]">No services available for {serviceType.name} at the moment.</p>
          <Link
            href="/book"
            className="inline-flex items-center gap-2 text-sm text-[var(--brand-primary)] hover:underline"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Service Types
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2">
            {services.map((service) => {
              const discountedPrice = calculateDiscountedPrice(service.priceCents, service.discountPercentage);
              const finalPriceWithFees = applyFeesToPrice(discountedPrice, pricingAdjustments);
              const basePriceWithFees = applyFeesToPrice(service.priceCents, pricingAdjustments);
              const hasDiscount = (service.discountPercentage ?? 0) > 0 && finalPriceWithFees < basePriceWithFees;

              return (
                <div
                  key={service.id}
                  className="group flex h-full flex-col rounded-2xl border-2 border-[var(--surface-border)] bg-[var(--surface)] shadow-sm transition-all hover:border-[var(--brand-primary)] hover:shadow-md overflow-hidden"
                >
                  {/* Image */}
                  {service.imageUrl && (
                    <div className="h-40 overflow-hidden relative">
                      <Image
                        src={service.imageUrl}
                        alt={service.name}
                        fill
                        sizes="(min-width: 640px) 50vw, 100vw"
                        className="object-cover transition duration-200 group-hover:scale-105"
                        priority={false}
                      />
                    </div>
                  )}

                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="text-xl font-semibold text-[var(--text-strong)] group-hover:text-[var(--brand-primary)]">
                          {service.name}
                        </h2>
                        {hasDiscount && typeof service.discountPercentage === "number" && (
                          <span className="flex-shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                            {service.discountPercentage}% off
                          </span>
                        )}
                      </div>

                      {service.description && (
                        <p className="text-sm text-[var(--text-muted)] line-clamp-2">{service.description}</p>
                      )}

                      <div className="flex items-center gap-4 text-sm text-[var(--text-muted)]">
                        <span className="flex items-center gap-1">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {service.durationMin} min
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-[var(--text-strong)]">
                          {formatter.format(finalPriceWithFees / 100)}
                        </span>
                        {hasDiscount && (
                          <span className="text-sm text-[var(--text-muted)] line-through">
                            {formatter.format(basePriceWithFees / 100)}
                          </span>
                        )}
                      </div>
                    </div>

                    <Link
                      href={buildBookingUrl(service.id)}
                      className="mt-5 inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-secondary)]"
                    >
                      Book Now
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-start">
            <Link
              href={`/book/${typeId}`}
              className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--brand-primary)]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Preferences
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
