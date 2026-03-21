/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
/* eslint-enable @typescript-eslint/no-require-imports */

async function checkDriverLocations() {
  const prisma = new PrismaClient();

  try {
    const drivers = await prisma.user.findMany({
      where: { role: 'DRIVER' },
      select: {
        id: true,
        name: true,
        currentLatitude: true,
        currentLongitude: true,
        locationUpdatedAt: true
      }
    });

    console.log('Driver location data:');
    console.log(JSON.stringify(drivers, null, 2));

    // Check driver days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const driverDays = await prisma.driverDay.findMany({
      where: {
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
      select: {
        driverId: true,
        status: true,
        startedAt: true,
        endedAt: true,
      },
    });

    console.log('\nDriver day status:');
    console.log(JSON.stringify(driverDays, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDriverLocations();
