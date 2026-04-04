const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testBookingSpotOrder() {
  try {
    console.log('Testing booking-based spot order creation...');

    // Find the driver user
    const driver = await prisma.user.findFirst({ 
      where: { 
        email: 'aslam1@gmail.com',
        role: 'DRIVER' 
      } 
    });

    if (!driver) {
      console.log('❌ Driver aslam1@gmail.com not found');
      return;
    }

    console.log(`✅ Found driver: ${driver.name} (${driver.id})`);

    // Get area and service
    const area = await prisma.area.findFirst({ where: { active: true } });
    const service = await prisma.service.findFirst();

    if (!area || !service) {
      console.log('❌ No active area or service found');
      return;
    }

    // Create a booking-based spot order (simulating what the API does)
    const now = new Date();
    const endTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour later
    const spotBooking = await prisma.booking.create({
      data: {
        userId: driver.id,
        driverId: driver.id,
        serviceId: service.id,
        status: 'PENDING',
        taskStatus: 'ASSIGNED',
        cashAmountCents: service.priceCents, // Use cashAmountCents instead of priceCents
        startAt: now,
        endAt: endTime,
        locationLabel: 'Test Spot Order Location',
        locationCoordinates: '25.2048,55.2708',
        vehiclePlate: 'SPOT-123',
        vehicleCount: 1,
        vehicleServiceDetails: 'Test spot order details',
        cashCollected: false,
        cashSettled: false,
      },
      include: {
        Service: true,
        User_Booking_userIdToUser: true,
        Payment: true,
      },
    });

    console.log('✅ Booking-based spot order created!');
    console.log(`ID: ${spotBooking.id}`);
    console.log(`Driver: ${spotBooking.User_Booking_userIdToUser.name}`);
    console.log(`Service: ${spotBooking.Service.name}`);
    console.log(`Status: ${spotBooking.taskStatus}`);
    console.log(`Source: ${spotBooking.source}`);
    console.log(`Payment: ${spotBooking.paymentMethod}`);

    // Test dashboard query for this driver (same logic as dashboard API)
    const dashboardBookings = await prisma.booking.findMany({
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
          {
            AND: [
              {
                cashSettled: {
                  not: true,
                },
              },
              {
                OR: [
                  { Payment: { is: null } },
                  { Payment: { status: "REQUIRES_PAYMENT" } },
                  { Payment: { provider: "CASH" } },
                ],
              },
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

    const spotBookings = dashboardBookings.filter(b => b.userId === b.driverId);
    const regularBookings = dashboardBookings.filter(b => b.userId !== b.driverId);

    console.log(`\n📊 Dashboard Results:`);
    console.log(`Total bookings: ${dashboardBookings.length}`);
    console.log(`Spot bookings: ${spotBookings.length}`);
    console.log(`Regular bookings: ${regularBookings.length}`);

    dashboardBookings.forEach(booking => {
      console.log(`- ${booking.Service.name} (${booking.taskStatus}) - userId: ${booking.userId}, driverId: ${booking.driverId}, isSpot: ${booking.userId === booking.driverId}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBookingSpotOrder();
