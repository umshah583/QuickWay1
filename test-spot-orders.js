const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkSpotOrders() {
  try {
    console.log('Checking for existing spot orders...');
    
    const spotOrders = await prisma.spotOrder.findMany({
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
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${spotOrders.length} spot orders:`);
    spotOrders.forEach(order => {
      console.log(`- ID: ${order.id}`);
      console.log(`  Driver: ${order.User_SpotOrder_driverIdToUser?.name || 'Unknown'} (${order.driverId})`);
      console.log(`  Service: ${order.Service?.name}`);
      console.log(`  Area: ${order.Area?.name}`);
      console.log(`  Status: ${order.status}`);
      console.log(`  Price: AED ${(order.priceCents / 100).toFixed(0)}`);
      console.log(`  Created: ${order.createdAt}`);
      console.log('---');
    });

    if (spotOrders.length === 0) {
      console.log('No spot orders found. Let\'s check drivers...');
      
      const drivers = await prisma.user.findMany({
        where: { role: 'DRIVER' },
        select: { id: true, name: true, email: true }
      });
      
      console.log(`Found ${drivers.length} drivers:`);
      drivers.forEach(driver => {
        console.log(`- ${driver.name} (${driver.id}) - ${driver.email}`);
      });
    }

  } catch (error) {
    console.error('Error checking spot orders:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSpotOrders();
