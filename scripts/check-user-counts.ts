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
            Booking_Booking_userIdToUser: true,
            PackageSubscription_PackageSubscription_userIdToUser: true,
            Booking_Booking_driverIdToUser: true,
            PackageSubscription_PackageSubscription_driverIdToUser: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const u of users) {
      const totalBookings = u._count.Booking_Booking_userIdToUser + u._count.Booking_Booking_driverIdToUser;
      const totalSubs =
        u._count.PackageSubscription_PackageSubscription_userIdToUser + u._count.PackageSubscription_PackageSubscription_driverIdToUser;
      console.log(`\n${u.email ?? 'No email'} (${u.name ?? 'No name'})`);
      console.log(
        `  bookings=${u._count.Booking_Booking_userIdToUser}, driverBookings=${u._count.Booking_Booking_driverIdToUser}, total=${totalBookings}`,
      );
      console.log(
        `  subs=${u._count.PackageSubscription_PackageSubscription_userIdToUser}, driverSubs=${u._count.PackageSubscription_PackageSubscription_driverIdToUser}, total=${totalSubs}`,
      );
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
