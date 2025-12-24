const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking partner commission snapshots...\n');

  // Find all bookings with partners
  const bookingsWithPartner = await prisma.booking.findMany({
    where: {
      partnerId: { not: null }
    },
    select: {
      id: true,
      status: true,
      taskStatus: true,
      partnerId: true,
      partnerCommissionPercentage: true,
      partner: {
        select: { name: true, commissionPercentage: true }
      }
    }
  });

  console.log(`Total bookings with partner: ${bookingsWithPartner.length}\n`);

  const withSnapshot = bookingsWithPartner.filter(b => typeof b.partnerCommissionPercentage === 'number');
  const withoutSnapshot = bookingsWithPartner.filter(b => b.partnerCommissionPercentage === null);

  console.log(`✅ With commission snapshot: ${withSnapshot.length}`);
  console.log(`❌ Without commission snapshot: ${withoutSnapshot.length}\n`);

  if (withoutSnapshot.length > 0) {
    console.log('Bookings WITHOUT snapshot (will recalculate with current rate!):');
    withoutSnapshot.forEach((b, i) => {
      console.log(`  ${i+1}. ${b.id.substring(0,8)}... | Partner: ${b.partner?.name || 'Unknown'} | Status: ${b.status} | Task: ${b.taskStatus}`);
    });
  }

  // Show what commission rates are stored
  console.log('\n📊 Snapshot values found:');
  const rates = {};
  withSnapshot.forEach(b => {
    const rate = b.partnerCommissionPercentage;
    rates[rate] = (rates[rate] || 0) + 1;
  });
  Object.entries(rates).sort((a,b) => Number(b[0]) - Number(a[0])).forEach(([rate, count]) => {
    console.log(`   ${rate}%: ${count} bookings`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
