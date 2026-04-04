const { PrismaClient } = require('@prisma/client');

async function checkSpotOrderNumbers() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Checking recent spot orders for invoice and order numbers...');
    
    // Get recent bookings where userId === driverId (spot orders)
    const spotOrders = await prisma.booking.findMany({
      where: {
        userId: 'user-1775248326720', // aslam's user ID
        driverId: 'user-1775248326720', // same user ID indicates spot order
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5,
      select: {
        id: true,
        invoiceNumber: true,
        orderNumber: true,
        status: true,
        taskStatus: true,
        createdAt: true,
        Service: {
          select: {
            name: true
          }
        }
      }
    });

    console.log(`\nFound ${spotOrders.length} recent spot orders:\n`);
    
    spotOrders.forEach((order, index) => {
      console.log(`${index + 1}. Booking ID: ${order.id}`);
      console.log(`   Service: ${order.Service?.name || 'Unknown'}`);
      console.log(`   Status: ${order.status} / ${order.taskStatus}`);
      console.log(`   Invoice Number: ${order.invoiceNumber || '❌ MISSING'}`);
      console.log(`   Order Number: ${order.orderNumber || '❌ MISSING'}`);
      console.log(`   Created: ${order.createdAt.toISOString()}`);
      console.log('');
    });

    // Check if any have missing numbers
    const missingInvoice = spotOrders.filter(order => !order.invoiceNumber).length;
    const missingOrder = spotOrders.filter(order => !order.orderNumber).length;
    
    console.log(`\n📊 Summary:`);
    console.log(`- Total checked: ${spotOrders.length}`);
    console.log(`- Missing invoice numbers: ${missingInvoice}`);
    console.log(`- Missing order numbers: ${missingOrder}`);
    
    if (missingInvoice === 0 && missingOrder === 0) {
      console.log(`\n🎉 SUCCESS: All spot orders have invoice and order numbers!`);
    } else {
      console.log(`\n❌ ISSUE: Some spot orders are missing invoice or order numbers`);
    }

  } catch (error) {
    console.error('❌ Error checking spot orders:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSpotOrderNumbers();
