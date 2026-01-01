import { prisma } from "@/lib/prisma";
import { PackagesClient } from "./PackagesClient";
import type { PackageRecord } from "./actions";

export const dynamic = "force-dynamic";

type SubscriptionCountRow = {
  packageId: string;
  _count: {
    _all: number;
  };
};

type PrismaWithPackages = typeof prisma & {
  monthlyPackage: {
    findMany: (args: unknown) => Promise<PackageRecord[]>;
  };
  packageSubscription: {
    groupBy: (args: unknown) => Promise<SubscriptionCountRow[]>;
  };
};

export default async function PackagesPage() {
  const packagesDb = prisma as PrismaWithPackages;
  const [packages, subscriptionCounts] = await Promise.all([
    packagesDb.monthlyPackage.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        serviceType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    packagesDb.packageSubscription.groupBy({
      by: ["packageId"],
      _count: { _all: true },
    }),
  ]);

  const subscribersByPackage = subscriptionCounts.reduce<Record<string, number>>((acc, row) => {
    acc[row.packageId] = row._count?._all ?? 0;
    return acc;
  }, {});

  return (
    <PackagesClient
      packages={packages}
      subscribersByPackage={subscribersByPackage}
    />
  );
}
