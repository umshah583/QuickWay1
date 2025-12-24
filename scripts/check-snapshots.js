const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check a few bookings to see their snapshot values
  const bookings = await prisma.booking.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      taxPercentage: true,
      stripeFeePercentage: true,
      extraFeeCents: true,
    }
  });

  console.log('Recent bookings snapshot values:');
  bookings.forEach((b, i) => {
    console.log(`${i+1}. ${b.id.substring(0,8)}... (${b.createdAt.toISOString().slice(0,10)})`);
    console.log(`   tax: ${b.taxPercentage}, stripe: ${b.stripeFeePercentage}, extra: ${b.extraFeeCents}`);
  });

  // Count bookings with null values
  const nullTax = await prisma.booking.count({ where: { taxPercentage: null } });
  const nullStripe = await prisma.booking.count({ where: { stripeFeePercentage: null } });
  const nullExtra = await prisma.booking.count({ where: { extraFeeCents: null } });
  const total = await prisma.booking.count();

  console.log('\nSnapshot field coverage:');
  console.log(`Total bookings: ${total}`);
  console.log(`Missing taxPercentage: ${nullTax}`);
  console.log(`Missing stripeFeePercentage: ${nullStripe}`);
  console.log(`Missing extraFeeCents: ${nullExtra}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
