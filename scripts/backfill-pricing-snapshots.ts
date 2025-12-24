/**
 * Backfill Pricing Snapshots Script
 * 
 * This script populates the pricing snapshot fields (taxPercentage, stripeFeePercentage, extraFeeCents)
 * on existing bookings that don't have them. This ensures old bookings have frozen pricing values
 * and won't change when admin updates global pricing settings.
 * 
 * Usage: npx ts-node scripts/backfill-pricing-snapshots.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Setting keys from pricingConstants.ts
const TAX_PERCENTAGE_SETTING_KEY = "64bf00000000000000000002";
const STRIPE_FEE_PERCENTAGE_SETTING_KEY = "64bf00000000000000000008";
const EXTRA_FEE_AMOUNT_SETTING_KEY = "64bf00000000000000000009";

function parsePercentageSetting(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value.replace(/,/g, '.'));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }
  return parsed;
}

function parseNonNegativeNumberSetting(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value.replace(/,/g, '.'));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

async function loadCurrentPricingSettings() {
  const settings = await prisma.adminSetting.findMany({
    where: {
      key: {
        in: [TAX_PERCENTAGE_SETTING_KEY, STRIPE_FEE_PERCENTAGE_SETTING_KEY, EXTRA_FEE_AMOUNT_SETTING_KEY],
      },
    },
  });

  const map = new Map(settings.map((s) => [s.key, s.value]));

  const taxPercentage = parsePercentageSetting(map.get(TAX_PERCENTAGE_SETTING_KEY));
  const stripeFeePercentage = parsePercentageSetting(map.get(STRIPE_FEE_PERCENTAGE_SETTING_KEY));
  const extraFeeAmount = parseNonNegativeNumberSetting(map.get(EXTRA_FEE_AMOUNT_SETTING_KEY));
  const extraFeeCents = extraFeeAmount !== null ? Math.round(extraFeeAmount * 100) : null;

  return {
    taxPercentage,
    stripeFeePercentage,
    extraFeeCents,
  };
}

async function main() {
  console.log('🔄 Starting pricing snapshots backfill...\n');

  // Load current pricing settings
  const currentSettings = await loadCurrentPricingSettings();
  console.log('📊 Current global pricing settings:');
  console.log(`   Tax %: ${currentSettings.taxPercentage ?? 'not set'}`);
  console.log(`   Stripe Fee %: ${currentSettings.stripeFeePercentage ?? 'not set'}`);
  console.log(`   Extra Fee (cents): ${currentSettings.extraFeeCents ?? 'not set'}`);
  console.log('');

  // Find bookings without snapshot values
  const bookingsWithoutSnapshots = await prisma.booking.findMany({
    where: {
      AND: [
        { taxPercentage: null },
        { stripeFeePercentage: null },
        { extraFeeCents: null },
      ],
    },
    select: {
      id: true,
      createdAt: true,
      service: { select: { name: true, priceCents: true, discountPercentage: true } },
    },
  });

  console.log(`📋 Found ${bookingsWithoutSnapshots.length} bookings without pricing snapshots\n`);

  if (bookingsWithoutSnapshots.length === 0) {
    console.log('✅ All bookings already have pricing snapshots. Nothing to do.');
    return;
  }

  // Show preview of what will be updated
  console.log('📝 Preview of bookings to update (first 10):');
  bookingsWithoutSnapshots.slice(0, 10).forEach((b, i) => {
    console.log(`   ${i + 1}. ${b.id.substring(0, 8)}... - ${b.service.name} (${b.createdAt.toISOString().slice(0, 10)})`);
  });
  if (bookingsWithoutSnapshots.length > 10) {
    console.log(`   ... and ${bookingsWithoutSnapshots.length - 10} more`);
  }
  console.log('');

  // Update in batches
  const BATCH_SIZE = 100;
  let updated = 0;

  for (let i = 0; i < bookingsWithoutSnapshots.length; i += BATCH_SIZE) {
    const batch = bookingsWithoutSnapshots.slice(i, i + BATCH_SIZE);
    const ids = batch.map((b) => b.id);

    await prisma.booking.updateMany({
      where: { id: { in: ids } },
      data: {
        taxPercentage: currentSettings.taxPercentage,
        stripeFeePercentage: currentSettings.stripeFeePercentage,
        extraFeeCents: currentSettings.extraFeeCents,
        // Also snapshot service price and discount if not already set
        // Note: servicePriceCents and serviceDiscountPercentage may need to be set individually
        // since they depend on each booking's service at the time of booking
      },
    });

    updated += batch.length;
    console.log(`⏳ Updated ${updated}/${bookingsWithoutSnapshots.length} bookings...`);
  }

  console.log('');
  console.log('✅ Backfill complete!');
  console.log(`   Updated ${updated} bookings with current pricing snapshot values.`);
  console.log('');
  console.log('⚠️  Note: These bookings now have the CURRENT global pricing settings frozen.');
  console.log('   If the original settings were different, you may need to manually adjust.');
}

main()
  .catch((e) => {
    console.error('❌ Error during backfill:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
