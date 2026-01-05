import { prisma } from "@/lib/prisma";

async function main() {
  const fragments = ["4b34b8", "3c8972"];

  const orders = await prisma.booking.findMany({
    where: {
      OR: fragments.map((fragment) => ({
        id: {
          contains: fragment,
          mode: "insensitive",
        },
      })),
    },
    select: {
      id: true,
      status: true,
      taskStatus: true,
      updatedAt: true,
    },
  });

  if (!orders.length) {
    console.log("No bookings matched the provided fragments:", fragments);
    return;
  }

  const formatted = orders.map((order) => ({
    id: order.id,
    status: order.status ?? "UNKNOWN",
    taskStatus: order.taskStatus ?? "UNKNOWN",
    updatedAt: order.updatedAt ?? "—",
  }));

  console.table(formatted);
}

main()
  .catch((error) => {
    console.error("Failed to fetch bookings:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
