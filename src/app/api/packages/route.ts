import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, noContentResponse } from "@/lib/api-response";
import { calculateDiscountedPrice } from "@/lib/pricing";

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
  discountedPriceCents: number;
  discountedPriceFormatted: string;
  discountPercent: number;
  popular: boolean;
  features: string[];
  serviceTypeId?: string | null;
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
  serviceIds: string[];
  serviceTypeId: string | null;
  selectedAttributes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaWithPackages = typeof prisma & {
  monthlyPackage: {
    findMany: (args: unknown) => Promise<MonthlyPackageRecord[]>;
  };
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const serviceTypeId = searchParams.get("serviceTypeId");
  const selectedAttributesParam = searchParams.get("selectedAttributes");

  let selectedAttributes: Record<string, string[]> | null = null;
  if (selectedAttributesParam) {
    try {
      selectedAttributes = JSON.parse(selectedAttributesParam);
    } catch (error) {
      console.error("Invalid selectedAttributes format:", error);
    }
  }

  const packagesDb = prisma as PrismaWithPackages;
  const packages = await packagesDb.monthlyPackage.findMany({
    where: {
      status: "ACTIVE",
      ...(serviceTypeId ? { serviceTypeId } : {}),
    },
    orderBy: [{ popular: "desc" }, { priceCents: "asc" }],
  });

  // Filter by selected attributes if provided
  let filteredPackages = packages;
  if (selectedAttributes && Object.keys(selectedAttributes).length > 0) {
    const attributeFilteredPackages = packages.filter(pkg => {
      if (!pkg.selectedAttributes) return false;

      try {
        const packageAttributes = JSON.parse(pkg.selectedAttributes);

        // Check if package supports all selected attribute combinations
        for (const [attrName, selectedValues] of Object.entries(selectedAttributes)) {
          if (!packageAttributes[attrName] || !Array.isArray(packageAttributes[attrName])) {
            return false;
          }

          // Check if package supports all selected values for this attribute
          const packageValues = packageAttributes[attrName];
          const hasAllValues = Array.isArray(selectedValues) && 
            selectedValues.every(selectedValue => packageValues.includes(selectedValue));
          
          if (!hasAllValues) {
            return false;
          }
        }

        return true;
      } catch (error) {
        console.error("Error parsing package attributes:", error);
        return false;
      }
    });

    // If no packages match the selected attributes, fall back to showing all packages
    // This allows users to see packages even if attribute filtering is too restrictive
    if (attributeFilteredPackages.length === 0) {
      console.log("No packages matched selected attributes, falling back to showing all packages");
      filteredPackages = packages;
    } else {
      filteredPackages = attributeFilteredPackages;
    }
  }

  const data: PublicPackage[] = filteredPackages.map((pkg) => ({
    id: pkg.id,
    name: pkg.name,
    description: pkg.description,
    duration: pkg.duration,
    washesPerMonth: pkg.washesPerMonth,
    priceCents: pkg.priceCents,
    priceFormatted: formatCurrency(pkg.priceCents),
    discountedPriceCents: calculateDiscountedPrice(pkg.priceCents, pkg.discountPercent ?? 0),
    discountedPriceFormatted: formatCurrency(
      calculateDiscountedPrice(pkg.priceCents, pkg.discountPercent ?? 0),
    ),
    discountPercent: pkg.discountPercent ?? 0,
    popular: pkg.popular,
    features: pkg.features,
    serviceTypeId: pkg.serviceTypeId,
  }));

  return jsonResponse({ data });
}

export function OPTIONS() {
  return noContentResponse("GET,OPTIONS");
}
