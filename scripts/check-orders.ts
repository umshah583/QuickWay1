import { prisma } from "@/lib/prisma";

type RawBooking = {
  _id: string;
  status?: string;
  taskStatus?: string;
  updatedAt?: string;
};

async function main() {
  const fragments = ["4b34b8", "3c8972"];

  const pipeline = [
    {
      $match: {
        $or: fragments.map((fragment) => ({
          _id: { $regex: fragment, $options: "i" },
        })),
      },
    },
    {
      $project: {
        _id: 1,
        status: 1,
        taskStatus: 1,
        updatedAt: 1,
      },
    },
  ];

  const orders = (await prisma.booking.aggregateRaw({
    pipeline,
  })) as unknown as RawBooking[];

  if (!orders.length) {
    console.log("No bookings matched the provided fragments:", fragments);
    return;
  }

  const formatted = orders.map((order) => ({
    id: order._id,
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
