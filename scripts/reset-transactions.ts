/**
 * Reset Transactional Data Script
 *
 * Deletes transactional data so you can start fresh for testing:
 * - Booking
 * - Payment
 * - PartnerPayout
 * - CouponRedemption
 * - PackageSubscription
 * - SubscriptionDailyDriver
 * - SubscriptionRequest
 * - Notification (optional, currently INCLUDED)
 *
 * WARNING: This is destructive and cannot be undone.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetTransactions() {
  console.log('🚨 STARTING TRANSACTIONAL DATA RESET...');
  console.log('');

  try {
    // Count current records
    const [
      bookingCount,
      paymentCount,
      payoutCount,
      couponRedemptionCount,
      subscriptionCount,
      subscriptionDailyCount,
      subscriptionRequestCount,
      notificationCount,
    ] = await Promise.all([
      prisma.booking.count(),
      prisma.payment.count(),
      prisma.partnerPayout.count(),
      prisma.couponRedemption.count(),
      prisma.packageSubscription.count(),
      prisma.subscriptionDailyDriver.count(),
      prisma.subscriptionRequest.count(),
      prisma.notification.count(),
    ]);

    console.log('📊 Current transactional data:');
    console.log(`   - Bookings:                ${bookingCount}`);
    console.log(`   - Payments:                ${paymentCount}`);
    console.log(`   - Partner payouts:         ${payoutCount}`);
    console.log(`   - Coupon redemptions:      ${couponRedemptionCount}`);
    console.log(`   - Package subscriptions:   ${subscriptionCount}`);
    console.log(`   - Subscription daily rows: ${subscriptionDailyCount}`);
    console.log(`   - Subscription requests:   ${subscriptionRequestCount}`);
    console.log(`   - Notifications:           ${notificationCount}`);
    console.log('');

    console.log('🗑️  Deleting child records first...');
    const deleteChildren = await Promise.all([
      prisma.subscriptionDailyDriver.deleteMany({}),
      prisma.subscriptionRequest.deleteMany({}),
      prisma.couponRedemption.deleteMany({}),
      prisma.notification.deleteMany({}),
    ]);

    console.log('   - Deleted child records:', deleteChildren.map(r => r.count));

    console.log('🗑️  Deleting parent transactional records...');
    const deleteParents = await Promise.all([
      prisma.packageSubscription.deleteMany({}),
      prisma.partnerPayout.deleteMany({}),
      prisma.payment.deleteMany({}),
      prisma.booking.deleteMany({}),
    ]);

    console.log('   - Deleted parent records:', deleteParents.map(r => r.count));

    console.log('');
    console.log('✅ SUCCESS: Transactional data has been reset.');
    console.log('   - Users, partners, services, coupons, settings remain intact.');
    console.log('');
    console.log('💡 Next steps:');
    console.log('   1. Restart your dev server if needed');
    console.log('   2. Create new test bookings and payments with the corrected pricing logic');

  } catch (error) {
    console.error('❌ ERROR while resetting transactions:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

resetTransactions()
  .then(() => {
    console.log('');
    console.log('Script completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
