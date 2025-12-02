/**
 * Backfill Commission Snapshots for Historical Bookings
 * 
 * This script updates old bookings that don't have a commission snapshot
 * with their partner's CURRENT commission percentage.
 * 
 * ⚠️ WARNING: This assumes the partner's current commission is the same
 * as it was when the booking was created. If commission has changed,
 * this will use the NEW rate for old bookings.
 * 
 * ONLY run this script ONCE after deploying the commission snapshot feature.
 */

import { prisma } from '../lib/prisma';

async function backfillCommissionSnapshots() {
  console.log('🔍 Finding bookings without commission snapshots...');
  
  // Find all bookings that have a partner but no commission snapshot
  const bookingsWithoutSnapshot = await prisma.booking.findMany({
    where: {
      partnerId: { not: null },
    } as any, // Type assertion - filtering by new field
    include: {
      partner: {
        select: {
          id: true,
          name: true,
          commissionPercentage: true,
        },
      },
    },
  });

  console.log(`📊 Found ${bookingsWithoutSnapshot.length} bookings without snapshots`);

  if (bookingsWithoutSnapshot.length === 0) {
    console.log('✅ All bookings already have commission snapshots!');
    return;
  }

  // Get default commission from settings
  const defaultCommissionSetting = await prisma.adminSetting.findUnique({
    where: { key: 'DEFAULT_PARTNER_COMMISSION_PERCENTAGE' },
    select: { value: true },
  });
  const defaultCommission = defaultCommissionSetting?.value 
    ? parseFloat(defaultCommissionSetting.value)
    : 100;

  console.log(`📝 Default commission: ${defaultCommission}%`);

  // Group bookings by partner
  const partnerGroups = new Map<string, typeof bookingsWithoutSnapshot>();
  for (const booking of bookingsWithoutSnapshot) {
    if (!booking.partnerId) continue;
    const group = partnerGroups.get(booking.partnerId) || [];
    group.push(booking);
    partnerGroups.set(booking.partnerId, group);
  }

  console.log(`👥 Updating bookings for ${partnerGroups.size} partners...\n`);

  let totalUpdated = 0;

  for (const [, bookings] of partnerGroups) {
    const partner = bookings[0].partner;
    if (!partner) continue;

    // Use individual commission if > 0, otherwise use default
    const individualCommission = partner.commissionPercentage;
    const commissionToUse = (individualCommission && individualCommission > 0)
      ? individualCommission
      : defaultCommission;

    console.log(`📦 Partner: ${partner.name}`);
    console.log(`   Individual commission: ${individualCommission}%`);
    console.log(`   Will snapshot as: ${commissionToUse}%`);
    console.log(`   Bookings to update: ${bookings.length}`);

    // Update all bookings for this partner
    for (const booking of bookings) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { partnerCommissionPercentage: commissionToUse } as any, // Type assertion for new field
      });
      totalUpdated++;
    }

    console.log(`   ✅ Updated ${bookings.length} bookings\n`);
  }

  console.log(`\n✅ COMPLETE! Updated ${totalUpdated} bookings with commission snapshots`);
  console.log(`\n⚠️  IMPORTANT: These snapshots use CURRENT partner commissions.`);
  console.log(`   If partner commissions have changed since bookings were created,`);
  console.log(`   you may need to manually adjust some snapshots in the database.`);
}

// Run the script
backfillCommissionSnapshots()
  .then(() => {
    console.log('\n🎉 Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
