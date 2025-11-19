import prisma from "@/lib/prisma";
import { jsonResponse, noContentResponse } from "@/lib/api-response";

export const dynamic = "force-dynamic";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

type PublicPackage = {
  id: string;
  name: string;
  description: string | null;
  duration: string;
  washesPerMonth: number;
  priceCents: number;
  priceFormatted: string;
  discountPercent: number;
  popular: boolean;
  features: string[];
};

type MonthlyPackageRecord = {
  id: string;
  name: string;
  description: string | null;
  duration: string;
  washesPerMonth: number;
  priceCents: number;
  discountPercent: number | null;
  popular: boolean;
  features: string[];
  status: string;
};

type PrismaWithPackages = typeof prisma & {
  monthlyPackage: {
    findMany: (args: unknown) => Promise<MonthlyPackageRecord[]>;
  };
};

export async function GET() {
  const packagesDb = prisma as PrismaWithPackages;
  const packages = await packagesDb.monthlyPackage.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ popular: "desc" }, { priceCents: "asc" }],
  });

  const data: PublicPackage[] = packages.map((pkg) => ({
    id: pkg.id,
    name: pkg.name,
    description: pkg.description,
    duration: pkg.duration,
    washesPerMonth: pkg.washesPerMonth,
    priceCents: pkg.priceCents,
    priceFormatted: formatCurrency(pkg.priceCents),
    discountPercent: pkg.discountPercent ?? 0,
    popular: pkg.popular,
    features: pkg.features,
  }));

  return jsonResponse({ data });
}

export function OPTIONS() {
  return noContentResponse("GET,OPTIONS");
}
