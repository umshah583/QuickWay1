const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEFAULT_PARTNER_COMMISSION_SETTING_KEY = "64bf0000000000000000000c";

async function main() {
  console.log('🔍 Debugging outstanding calculation...\n');

  // Get all partners
  const partners = await prisma.partner.findMany({
    select: {
      id: true,
      name: true,
      commissionPercentage: true,
    }
  });

  // Get default commission
  const defaultSetting = await prisma.adminSetting.findUnique({
    where: { key: DEFAULT_PARTNER_COMMISSION_SETTING_KEY },
    select: { value: true }
  });
  const defaultCommission = defaultSetting?.value ? parseFloat(defaultSetting.value) : 100;

  for (const partner of partners) {
    console.log(`\n========== PARTNER: ${partner.name} ==========`);
    console.log(`Current commission rate: ${partner.commissionPercentage ?? defaultCommission}%`);

    // Get all bookings for this partner (direct + via drivers)
    const bookings = await prisma.booking.findMany({
      where: {
        OR: [
          { partnerId: partner.id },
          { driver: { partnerId: partner.id } }
        ]
      },
      select: {
        id: true,
        status: true,
        taskStatus: true,
        cashCollected: true,
        cashSettled: true,
        partnerCommissionPercentage: true,
        payment: { select: { status: true, amountCents: true } },
        cashAmountCents: true,
        service: { select: { priceCents: true } }
      }
    });

    console.log(`Total bookings: ${bookings.length}`);

    // Calculate what SHOULD be the total net using snapshots
    let totalNetWithSnapshots = 0;
    let totalNetWithCurrentRate = 0;
    const currentRate = partner.commissionPercentage ?? defaultCommission;

    bookings.forEach((b, idx) => {
      // Check if settled (completed + payment done)
      const isCompleted = b.taskStatus === 'COMPLETED';
      const isPaid = b.payment?.status === 'PAID';
      const isCashSettled = b.cashCollected && b.cashSettled;
      const isSettled = isCompleted && (isPaid || isCashSettled);

      if (!isSettled) {
        console.log(`  ${idx+1}. ${b.id.substring(0,8)}... SKIPPED (not settled: completed=${isCompleted}, paid=${isPaid}, cashSettled=${isCashSettled})`);
        return;
      }

      // Get gross
      let gross = 0;
      if (b.payment?.status === 'PAID') {
        gross = b.payment.amountCents ?? b.service?.priceCents ?? 0;
      } else if (b.cashCollected) {
        gross = b.cashAmountCents ?? b.service?.priceCents ?? 0;
      }

      if (gross <= 0) {
        console.log(`  ${idx+1}. ${b.id.substring(0,8)}... SKIPPED (no gross)`);
        return;
      }

      // Calculate net with snapshot vs current
      const snapshotRate = b.partnerCommissionPercentage;
      const hasSnapshot = typeof snapshotRate === 'number';
      
      const rateUsedForSnapshot = hasSnapshot ? snapshotRate : currentRate;
      const netWithSnapshot = Math.round(gross * (rateUsedForSnapshot / 100));
      const netWithCurrent = Math.round(gross * (currentRate / 100));

      totalNetWithSnapshots += netWithSnapshot;
      totalNetWithCurrentRate += netWithCurrent;

      console.log(`  ${idx+1}. ${b.id.substring(0,8)}... Gross: ${gross}, Snapshot: ${snapshotRate ?? 'NONE'}, Net(snap): ${netWithSnapshot}, Net(current): ${netWithCurrent}`);
    });

    // Get payouts
    const payouts = await prisma.partnerPayout.findMany({
      where: { partnerId: partner.id },
      select: { amountCents: true }
    });
    const totalPaid = payouts.reduce((sum, p) => sum + p.amountCents, 0);

    console.log(`\n📊 SUMMARY for ${partner.name}:`);
    console.log(`   Total net (using snapshots): ${totalNetWithSnapshots} fils`);
    console.log(`   Total net (using current ${currentRate}%): ${totalNetWithCurrentRate} fils`);
    console.log(`   Total paid out: ${totalPaid} fils`);
    console.log(`   Outstanding (with snapshots): ${Math.max(0, totalNetWithSnapshots - totalPaid)} fils`);
    console.log(`   Outstanding (with current rate): ${Math.max(0, totalNetWithCurrentRate - totalPaid)} fils`);
    
    if (totalNetWithSnapshots !== totalNetWithCurrentRate) {
      console.log(`   ⚠️  DIFFERENCE: ${totalNetWithCurrentRate - totalNetWithSnapshots} fils`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
