const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDashboardAPI() {
  try {
    console.log('Testing dashboard API logic...');

    // Get the first driver
    const driver = await prisma.user.findFirst({ where: { role: 'DRIVER' } });
    if (!driver) {
      console.log('No driver found');
      return;
    }

    console.log(`Testing for driver: ${driver.name} (${driver.id})`);

    // Fetch incomplete bookings (like the dashboard API does)
    const bookings = await prisma.booking.findMany({
      where: {
        driverId: driver.id,
        OR: [
          {
            AND: [
              { driverId: { not: null } },
              { taskStatus: { not: "COMPLETED" } },
              {
                OR: [
                  { Payment: { is: null } },
                  { Payment: { provider: { not: "STRIPE" } } },
                ],
              },
            ],
          },
          {
            AND: [
              { cashCollected: true },
              { cashSettled: { not: true } },
            ],
          },
        ],
      },
      include: {
        Service: true,
        User_Booking_userIdToUser: true,
        Payment: true,
      },
      orderBy: { startAt: "asc" },
    });

    // Fetch spot orders (like the dashboard API does)
    const spotOrders = await prisma.spotOrder.findMany({
      where: {
        driverId: driver.id,
        status: { not: "COMPLETED" },
      },
      include: {
        Area: { select: { id: true, name: true, description: true, active: true } },
        Service: { select: { id: true, name: true, priceCents: true, durationMin: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    console.log(`\n📊 Dashboard Results for ${driver.name}:`);
    console.log(`- Bookings: ${bookings.length}`);
    console.log(`- Spot Orders: ${spotOrders.length}`);
    
    if (spotOrders.length > 0) {
      console.log('\n📍 Spot Orders found:');
      spotOrders.forEach(order => {
        console.log(`  - ${order.Service.name} at ${order.Area.name} (${order.status}) - AED ${(order.priceCents / 100).toFixed(0)}`);
      });
    }

    // Simulate the dashboard response
    const assignmentBookings = bookings.filter(booking => 
      booking.taskStatus === "ASSIGNED" || booking.taskStatus === "IN_PROGRESS"
    );

    const showAssignmentsEmpty = assignmentBookings.length === 0 && spotOrders.length === 0;

    console.log(`\n📋 Dashboard Summary:`);
    console.log(`- Assignment Bookings: ${assignmentBookings.length}`);
    console.log(`- Spot Orders: ${spotOrders.length}`);
    console.log(`- Show Assignments Empty: ${showAssignmentsEmpty}`);

  } catch (error) {
    console.error('❌ Error testing dashboard API:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDashboardAPI();
