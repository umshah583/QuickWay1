/**
 * Reset Partner Payouts Script
 * 
 * This script deletes ALL partner payouts from the database to allow
 * recalculation with the corrected fee deduction formula.
 * 
 * WARNING: This is a destructive operation and cannot be undone!
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetPartnerPayouts() {
  console.log('🚨 STARTING PARTNER PAYOUT RESET...');
  console.log('');

  try {
    // Get current payout statistics before deletion
    const allPayouts = await prisma.partnerPayout.findMany({
      include: {
        partner: { select: { name: true } },
      },
    });

    const totalPayouts = allPayouts.length;
    const totalAmountCents = allPayouts.reduce((sum, p) => sum + p.amountCents, 0);

    console.log(`📊 Current state:`);
    console.log(`   - Total payout records: ${totalPayouts}`);
    console.log(`   - Total amount: ${(totalAmountCents / 100).toFixed(2)} AED`);
    console.log('');

    // Group by partner
    const byPartner = new Map<string, { name: string; count: number; totalCents: number }>();
    allPayouts.forEach(p => {
      const existing = byPartner.get(p.partnerId);
      if (existing) {
        existing.count += 1;
        existing.totalCents += p.amountCents;
      } else {
        byPartner.set(p.partnerId, {
          name: p.partner.name,
          count: 1,
          totalCents: p.amountCents,
        });
      }
    });

    console.log(`📋 Breakdown by partner:`);
    byPartner.forEach(({ name, count, totalCents }) => {
      console.log(`   - ${name}: ${count} payouts, ${(totalCents / 100).toFixed(2)} AED`);
    });
    console.log('');

    // Delete all payouts
    console.log('🗑️  Deleting all partner payouts...');
    const result = await prisma.partnerPayout.deleteMany({});

    console.log('');
    console.log(`✅ SUCCESS!`);
    console.log(`   - Deleted ${result.count} payout records`);
    console.log('   - All partners now have 0 payouts and can be paid based on correct calculations');
    console.log('');
    console.log('💡 Next steps:');
    console.log('   1. Refresh the admin partners page');
    console.log('   2. Review outstanding amounts for each partner');
    console.log('   3. Create new payouts using the corrected net amounts');

  } catch (error) {
    console.error('❌ ERROR:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
resetPartnerPayouts()
  .then(() => {
    console.log('');
    console.log('Script completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
