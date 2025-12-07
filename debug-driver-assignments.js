// Quick debug script to check driver assignments
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugDriverAssignments() {
  console.log('=== DRIVER ASSIGNMENT DEBUG ===\n');

  // Check drivers
  const drivers = await prisma.user.findMany({
    where: { role: 'DRIVER' },
    select: { id: true, name: true, email: true, role: true }
  });
  console.log('Drivers in system:');
  drivers.forEach(d => console.log(`- ${d.name || d.email} (${d.id})`));
  console.log();

  // Check bookings with driver assignments
  const bookings = await prisma.booking.findMany({
    select: {
      id: true,
      status: true,
      taskStatus: true,
      driverId: true,
      service: { select: { name: true } },
      driver: { select: { name: true, email: true } }
    }
  });

  console.log('All bookings:');
  bookings.forEach(b => {
    const driverName = b.driver ? (b.driver.name || b.driver.email) : 'No driver';
    console.log(`- Booking ${b.id}: ${b.service?.name || 'Unknown service'}`);
    console.log(`  Status: ${b.status}, Task Status: ${b.taskStatus}, Driver: ${driverName} (${b.driverId || 'none'})`);
  });
  console.log();

  // Check specifically for assigned bookings
  const assignedBookings = bookings.filter(b => b.driverId);
  console.log(`Bookings with drivers assigned: ${assignedBookings.length}`);
  assignedBookings.forEach(b => {
    console.log(`- ${b.id}: ${b.service?.name} -> ${b.driver?.name || b.driver?.email} (taskStatus: ${b.taskStatus})`);
  });
  console.log();

  // Check for bookings that should show in driver dashboard
  const dashboardBookings = bookings.filter(b =>
    b.driverId && (
      b.taskStatus !== 'COMPLETED' ||
      (b.cashSettled !== true && b.cashCollected === true)
    )
  );
  console.log(`Bookings that should appear in driver dashboards: ${dashboardBookings.length}`);
  dashboardBookings.forEach(b => {
    console.log(`- ${b.id}: ${b.service?.name} for driver ${b.driver?.name || b.driver?.email}`);
  });

  await prisma.$disconnect();
}

debugDriverAssignments().catch(console.error);
