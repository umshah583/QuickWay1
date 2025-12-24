const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEFAULT_PARTNER_COMMISSION_SETTING_KEY = "64bf0000000000000000000c";

async function main() {
  console.log('🔍 Finding ALL bookings with partner connection but no commission snapshot...\n');

  // Get default commission
  const defaultSetting = await prisma.adminSetting.findUnique({
    where: { key: DEFAULT_PARTNER_COMMISSION_SETTING_KEY },
    select: { value: true }
  });
  const defaultCommission = defaultSetting?.value ? parseFloat(defaultSetting.value) : 100;
  console.log(`Default commission: ${defaultCommission}%\n`);

  // Find bookings that:
  // 1. Have partnerId directly, OR
  // 2. Have a driver who has a partnerId
  // AND have no commission snapshot
  const allBookings = await prisma.booking.findMany({
    select: {
      id: true,
      partnerId: true,
      partnerCommissionPercentage: true,
      driver: {
        select: {
          id: true,
          partnerId: true,
          partner: {
            select: { commissionPercentage: true }
          }
        }
      },
      partner: {
        select: { commissionPercentage: true }
      }
    }
  });

  // Filter to find bookings connected to a partner (directly or via driver) but missing snapshot
  const needsUpdate = allBookings.filter(b => {
    const hasPartnerConnection = b.partnerId || b.driver?.partnerId;
    const missingSnapshot = b.partnerCommissionPercentage === null;
    return hasPartnerConnection && missingSnapshot;
  });

  console.log(`Total bookings: ${allBookings.length}`);
  console.log(`Bookings with partner connection but NO commission snapshot: ${needsUpdate.length}\n`);

  if (needsUpdate.length === 0) {
    console.log('✅ All partner-connected bookings have commission snapshots!');
    return;
  }

  console.log('Bookings needing update:');
  needsUpdate.forEach((b, i) => {
    const partnerSource = b.partnerId ? 'direct' : 'via driver';
    console.log(`  ${i+1}. ${b.id} (${partnerSource})`);
  });

  // Update each booking
  let updated = 0;
  for (const booking of needsUpdate) {
    // Determine commission to use:
    // 1. From direct partner
    // 2. From driver's partner
    // 3. Default
    let commissionToSnapshot = defaultCommission;
    
    if (booking.partner?.commissionPercentage && booking.partner.commissionPercentage > 0) {
      commissionToSnapshot = booking.partner.commissionPercentage;
    } else if (booking.driver?.partner?.commissionPercentage && booking.driver.partner.commissionPercentage > 0) {
      commissionToSnapshot = booking.driver.partner.commissionPercentage;
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: { partnerCommissionPercentage: commissionToSnapshot }
    });

    console.log(`  ✓ Updated ${booking.id} with ${commissionToSnapshot}%`);
    updated++;
  }

  console.log(`\n✅ Fixed ${updated} bookings with commission snapshots.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
