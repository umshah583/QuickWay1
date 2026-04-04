const { PrismaClient } = require('@prisma/client');

async function testIdentifierGeneration() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Testing identifier generation directly...');
    
    // Test the generateBookingIdentifiers function
    const { generateBookingIdentifiers } = require('./src/lib/booking-identifiers.js');
    
    const result = await generateBookingIdentifiers('Spot Order');
    console.log('Generated identifiers:', result);
    
    // Check if invoice_sequences table exists and has data
    const sequences = await prisma.invoice_sequences.findMany();
    console.log('\nInvoice sequences in database:', sequences.length);
    sequences.forEach(seq => {
      console.log(`- ${seq.areaCode}/${seq.year}: ${seq.currentValue}`);
    });
    
  } catch (error) {
    console.error('❌ Error testing identifier generation:', error);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testIdentifierGeneration();
