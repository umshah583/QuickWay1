const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEFAULT_PARTNER_COMMISSION_SETTING_KEY = "64bf0000000000000000000c";

async function main() {
  console.log('🔄 Starting partner commission snapshots backfill...\n');

  // Load default commission setting
  const defaultSetting = await prisma.adminSetting.findUnique({
    where: { key: DEFAULT_PARTNER_COMMISSION_SETTING_KEY },
    select: { value: true }
  });
  const defaultCommission = defaultSetting?.value ? parseFloat(defaultSetting.value) : 100;
  console.log(`📊 Default commission: ${defaultCommission}%\n`);

  // Find all bookings with a partner but no commission snapshot
  const bookingsNeedingUpdate = await prisma.booking.findMany({
    where: {
      partnerId: { not: null },
      partnerCommissionPercentage: null,
    },
    select: {
      id: true,
      partnerId: true,
      partner: {
        select: { 
          id: true,
          name: true,
          commissionPercentage: true 
        }
      }
    }
  });

  console.log(`📋 Found ${bookingsNeedingUpdate.length} bookings needing commission snapshot\n`);

  if (bookingsNeedingUpdate.length === 0) {
    console.log('✅ All partner bookings already have commission snapshots!');
    return;
  }

  // Group by partner for logging
  const byPartner = {};
  bookingsNeedingUpdate.forEach(b => {
    const pName = b.partner?.name || 'Unknown';
    byPartner[pName] = (byPartner[pName] || 0) + 1;
  });
  console.log('Bookings by partner:');
  Object.entries(byPartner).forEach(([name, count]) => {
    console.log(`   ${name}: ${count} bookings`);
  });
  console.log('');

  // Update each booking with current partner commission (frozen as snapshot)
  let updated = 0;
  for (const booking of bookingsNeedingUpdate) {
    // Use partner's individual commission if set, otherwise default
    const partnerCommission = booking.partner?.commissionPercentage;
    const commissionToSnapshot = (partnerCommission !== null && partnerCommission !== undefined && partnerCommission > 0)
      ? partnerCommission
      : defaultCommission;

    await prisma.booking.update({
      where: { id: booking.id },
      data: { partnerCommissionPercentage: commissionToSnapshot }
    });

    updated++;
    if (updated % 10 === 0) {
      console.log(`⏳ Updated ${updated}/${bookingsNeedingUpdate.length}...`);
    }
  }

  console.log(`\n✅ Backfill complete! Updated ${updated} bookings.`);
  console.log('   Partner commissions are now frozen - changing partner % won\'t affect old bookings.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
