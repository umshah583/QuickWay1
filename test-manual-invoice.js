const { PrismaClient } = require('@prisma/client');

async function testManualInvoice() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Testing manual invoice/order number assignment...');
    
    // Get the most recent spot order without invoice/order numbers
    const spotOrder = await prisma.booking.findFirst({
      where: {
        userId: 'user-1775248326720',
        driverId: 'user-1775248326720',
        invoiceNumber: null,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!spotOrder) {
      console.log('❌ No spot order found without invoice number');
      return;
    }

    console.log(`Found spot order: ${spotOrder.id}`);
    console.log(`Current invoiceNumber: ${spotOrder.invoiceNumber}`);
    console.log(`Current orderNumber: ${spotOrder.orderNumber}`);

    // Generate simple identifiers manually
    const now = new Date();
    const year = now.getFullYear();
    const randomDigits = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join("");
    const orderNumber = `O-${year}-${randomDigits}`;
    const invoiceNumber = `SPO/${year}/00001`; // Simple format for spot orders

    console.log(`Generated identifiers:`);
    console.log(`- Invoice: ${invoiceNumber}`);
    console.log(`- Order: ${orderNumber}`);

    // Update the booking
    const updated = await prisma.booking.update({
      where: { id: spotOrder.id },
      data: {
        invoiceNumber: invoiceNumber,
        orderNumber: orderNumber,
      }
    });

    console.log(`✅ Successfully updated booking ${updated.id}`);
    console.log(`- Invoice Number: ${updated.invoiceNumber}`);
    console.log(`- Order Number: ${updated.orderNumber}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testManualInvoice();
