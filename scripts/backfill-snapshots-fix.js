const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Setting keys from pricingConstants.ts
const TAX_PERCENTAGE_SETTING_KEY = "64bf00000000000000000002";
const STRIPE_FEE_PERCENTAGE_SETTING_KEY = "64bf00000000000000000008";
const EXTRA_FEE_AMOUNT_SETTING_KEY = "64bf00000000000000000009";

function parseNumber(value) {
  if (!value) return null;
  const parsed = parseFloat(value.replace(/,/g, '.'));
  if (!isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

async function main() {
  console.log('🔄 Starting pricing snapshots backfill...\n');

  // Load current pricing settings
  const settings = await prisma.adminSetting.findMany({
    where: {
      key: { in: [TAX_PERCENTAGE_SETTING_KEY, STRIPE_FEE_PERCENTAGE_SETTING_KEY, EXTRA_FEE_AMOUNT_SETTING_KEY] }
    }
  });

  const map = new Map(settings.map(s => [s.key, s.value]));
  const taxPercentage = parseNumber(map.get(TAX_PERCENTAGE_SETTING_KEY));
  const stripeFeePercentage = parseNumber(map.get(STRIPE_FEE_PERCENTAGE_SETTING_KEY));
  const extraFeeAmount = parseNumber(map.get(EXTRA_FEE_AMOUNT_SETTING_KEY));
  const extraFeeCents = extraFeeAmount !== null ? Math.round(extraFeeAmount * 100) : null;

  console.log('📊 Current global pricing settings:');
  console.log(`   Tax %: ${taxPercentage ?? 'not set'}`);
  console.log(`   Stripe Fee %: ${stripeFeePercentage ?? 'not set'}`);
  console.log(`   Extra Fee (cents): ${extraFeeCents ?? 'not set'}\n`);

  // Find ALL bookings and check which ones need updating
  const allBookings = await prisma.booking.findMany({
    select: {
      id: true,
      taxPercentage: true,
      stripeFeePercentage: true,
      extraFeeCents: true,
    }
  });

  const needsUpdate = allBookings.filter(b => 
    b.taxPercentage === null || 
    b.stripeFeePercentage === null || 
    b.extraFeeCents === null
  );

  console.log(`📋 Total bookings: ${allBookings.length}`);
  console.log(`📋 Bookings needing snapshot update: ${needsUpdate.length}\n`);

  if (needsUpdate.length === 0) {
    console.log('✅ All bookings already have pricing snapshots!');
    return;
  }

  // Update each booking individually (MongoDB doesn't support updateMany with complex conditions well)
  let updated = 0;
  for (const booking of needsUpdate) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        taxPercentage: booking.taxPercentage ?? taxPercentage,
        stripeFeePercentage: booking.stripeFeePercentage ?? stripeFeePercentage,
        extraFeeCents: booking.extraFeeCents ?? extraFeeCents,
      }
    });
    updated++;
    if (updated % 10 === 0) {
      console.log(`⏳ Updated ${updated}/${needsUpdate.length}...`);
    }
  }

  console.log(`\n✅ Backfill complete! Updated ${updated} bookings.`);
  console.log('   Old transactions will now keep their frozen pricing values.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
