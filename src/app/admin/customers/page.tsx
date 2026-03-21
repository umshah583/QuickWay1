import { prisma } from "@/lib/prisma";
import { CustomersManagementClient } from "./CustomersManagementClient";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  // Fetch all customers
  const customers = await prisma.user.findMany({
    where: { role: "USER" },
    orderBy: { createdAt: "desc" },
  });

  // Calculate customer metrics
  const customersWithMetrics = customers.map(customer => {
    const totalBookings = 0; // We'll need to fetch this separately if needed
    const lifetimeValue = 0; // We'll need to fetch this separately if needed
    const activeSubscriptions = 0; // We'll need to fetch this separately if needed

    return {
      ...customer,
      totalBookings,
      lifetimeValue,
      activeSubscriptions,
    };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <CustomersManagementClient customers={customersWithMetrics as any} />;
}
