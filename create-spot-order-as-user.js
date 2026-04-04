const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createSpotOrderForUser() {
  try {
    console.log('Creating spot order for user aslam1@gmail.com...');

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

    // Create spot order
    const spotOrder = await prisma.spotOrder.create({
      data: {
        driverId: driver.id,
        zoneId: area.id,
        serviceId: service.id,
        locationLabel: 'Test Location for User',
        locationCoordinates: '25.2048,55.2708',
        vehiclePlate: 'USER-123',
        vehicleCount: 1,
        status: 'ACCEPTED',
        priceCents: service.priceCents,
      },
      include: {
        Area: true,
        Service: true,
        User_SpotOrder_driverIdToUser: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    console.log('✅ Spot order created for user!');
    console.log(`ID: ${spotOrder.id}`);
    console.log(`Driver: ${spotOrder.User_SpotOrder_driverIdToUser.name} (${spotOrder.User_SpotOrder_driverIdToUser.email})`);
    console.log(`Service: ${spotOrder.Service.name} at ${spotOrder.Area.name}`);
    console.log(`Status: ${spotOrder.status}`);

    // Test dashboard query for this specific driver
    const dashboardSpotOrders = await prisma.spotOrder.findMany({
      where: {
        driverId: driver.id,
        status: { not: "COMPLETED" }
      },
      include: {
        Area: { select: { id: true, name: true, description: true, active: true } },
        Service: { select: { id: true, name: true, priceCents: true, durationMin: true } },
      }
    });

    console.log(`\n📊 Dashboard query for ${driver.email}:`);
    console.log(`Found ${dashboardSpotOrders.length} spot orders`);
    dashboardSpotOrders.forEach(order => {
      console.log(`- ${order.Service.name} (${order.status})`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createSpotOrderForUser();
