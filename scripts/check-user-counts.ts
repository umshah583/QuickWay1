import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        _count: {
          select: {
            bookings: true,
            packageSubscriptions: true,
            driverBookings: true,
            driverPackageSubscriptions: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const u of users) {
      const totalBookings = u._count.bookings + u._count.driverBookings;
      const totalSubs =
        u._count.packageSubscriptions + u._count.driverPackageSubscriptions;
      console.log(`\n${u.email ?? 'No email'} (${u.name ?? 'No name'})`);
      console.log(
        `  bookings=${u._count.bookings}, driverBookings=${u._count.driverBookings}, total=${totalBookings}`,
      );
      console.log(
        `  subs=${u._count.packageSubscriptions}, driverSubs=${u._count.driverPackageSubscriptions}, total=${totalSubs}`,
      );
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
