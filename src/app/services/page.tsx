import Link from "next/link";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { applyFeesToPrice, calculateDiscountedPrice } from "@/lib/pricing";
import { computeLoyaltySummary } from "@/lib/loyalty";
import { getFeatureFlags } from "@/lib/admin-settings";
import { loadPricingAdjustmentConfig } from "@/lib/pricingSettings";

function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

export default async function ServicesPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  const [services, pricingAdjustments] = await Promise.all([
    prisma.service.findMany({
      where: { active: true },
      orderBy: { priceCents: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        durationMin: true,
        priceCents: true,
        discountPercentage: true,
      },
    }),
    loadPricingAdjustmentConfig(),
  ]);

  const featureFlags = await getFeatureFlags();
  const loyaltySummary = userId && featureFlags.enableLoyalty ? await computeLoyaltySummary(userId) : null;
  const formatter = new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" });

  const freeWashBadgeText = loyaltySummary?.freeWashInterval && loyaltySummary.nextFreeWashIn !== null
    ? `${loyaltySummary.nextFreeWashIn} ${pluralize(loyaltySummary.nextFreeWashIn, "wash", "washes")} away from a free service`
    : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Services & Pricing</h1>
        {freeWashBadgeText ? (
          <div className="inline-flex items-center gap-2 self-start rounded-full bg-amber-100 px-4 py-1 text-sm font-medium text-amber-700">
            <span className="inline-flex h-2 w-2 rounded-full bg-amber-500" aria-hidden />
            {freeWashBadgeText}
            {loyaltySummary?.freeWashInterval ? (
              <span className="text-amber-500">
                ({loyaltySummary.nextFreeWashIn ? `${loyaltySummary.freeWashInterval - loyaltySummary.nextFreeWashIn}/${loyaltySummary.freeWashInterval}` : loyaltySummary.freeWashInterval})
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        {services.map((service) => {
          const discountedPrice = calculateDiscountedPrice(service.priceCents, service.discountPercentage);
          const finalPriceWithFees = applyFeesToPrice(discountedPrice, pricingAdjustments);
          const basePriceWithFees = applyFeesToPrice(service.priceCents, pricingAdjustments);
          const hasDiscount = (service.discountPercentage ?? 0) > 0 && finalPriceWithFees < basePriceWithFees;

          return (
            <div key={service.id} className="flex h-full flex-col justify-between rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-5 shadow-sm">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <h2 className="text-xl font-semibold text-[var(--text-strong)]">{service.name}</h2>
                  {hasDiscount && typeof service.discountPercentage === "number" ? (
                    <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-semibold text-emerald-700">
                      {service.discountPercentage}% off
                    </span>
                  ) : null}
                </div>
                {service.description ? (
                  <p className="text-sm text-[var(--text-muted)]">{service.description}</p>
                ) : null}
                <p className="text-xs uppercase text-[var(--text-muted)]">Duration: {service.durationMin} minutes</p>
                <div className="flex items-center gap-3 text-lg font-semibold text-[var(--text-strong)]">
                  {formatter.format(finalPriceWithFees / 100)}
                  {hasDiscount ? (
                    <span className="text-sm font-normal text-[var(--text-muted)] line-through">
                      {formatter.format(basePriceWithFees / 100)}
                    </span>
                  ) : null}
                </div>
              </div>
              <Link
                href={`/booking?service=${service.id}`}
                className="mt-6 inline-flex items-center justify-center rounded-lg border border-[var(--surface-border)] px-3 py-2 text-sm font-semibold text-[var(--text-strong)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
              >
                Book now
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
