const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Update all bookings with 85% commission to 79% (the rate at which payouts were made)
  const result = await prisma.booking.updateMany({
    where: { partnerCommissionPercentage: 85 },
    data: { partnerCommissionPercentage: 79 }
  });
  
  console.log(`Updated ${result.count} bookings from 85% to 79%`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
