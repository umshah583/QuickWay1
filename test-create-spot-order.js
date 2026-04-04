const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestSpotOrder() {
  try {
    console.log('Creating test spot order...');

    // First get a driver, area, and service
    const driver = await prisma.user.findFirst({ where: { role: 'DRIVER' } });
    const area = await prisma.area.findFirst({ where: { active: true } });
    const service = await prisma.service.findFirst();

    if (!driver || !area || !service) {
      console.log('Missing required data:');
      console.log('Driver:', !!driver);
      console.log('Area:', !!area);
      console.log('Service:', !!service);
      return;
    }

    console.log(`Using driver: ${driver.name} (${driver.id})`);
    console.log(`Using area: ${area.name} (${area.id})`);
    console.log(`Using service: ${service.name} (${service.id})`);

    // Create the spot order
    const spotOrder = await prisma.spotOrder.create({
      data: {
        driverId: driver.id,
        zoneId: area.id,
        serviceId: service.id,
        locationLabel: 'Test Location',
        locationCoordinates: '25.2048,55.2708',
        vehiclePlate: 'TEST-123',
        vehicleCount: 1,
        status: 'ACCEPTED',
        priceCents: service.priceCents,
      },
      include: {
        Area: true,
        Service: true,
        User_SpotOrder_driverIdToUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    console.log('✅ Spot order created successfully!');
    console.log(`ID: ${spotOrder.id}`);
    console.log(`Driver: ${spotOrder.User_SpotOrder_driverIdToUser.name}`);
    console.log(`Service: ${spotOrder.Service.name}`);
    console.log(`Area: ${spotOrder.Area.name}`);
    console.log(`Status: ${spotOrder.status}`);
    console.log(`Price: AED ${(spotOrder.priceCents / 100).toFixed(0)}`);

  } catch (error) {
    console.error('❌ Error creating spot order:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestSpotOrder();
