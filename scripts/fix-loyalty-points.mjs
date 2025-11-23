/**
 * Fix Loyalty Points Data Integrity
 * 
 * This script recalculates and fixes loyaltyRedeemedPoints for all users
 * based on their actual booking history.
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fixLoyaltyPoints() {
  console.log('🔍 Starting loyalty points data integrity fix...\n');

  try {
    // Fetch all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        loyaltyRedeemedPoints: true,
      },
    });

    console.log(`Found ${users.length} users\n`);

    for (const user of users) {
      console.log(`\n📊 Checking user: ${user.name || user.email || user.id}`);
      console.log(`   Current loyaltyRedeemedPoints: ${user.loyaltyRedeemedPoints || 0}`);

      // Calculate actual redeemed points from bookings
      const bookings = await prisma.booking.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          loyaltyPointsApplied: true,
          status: true,
        },
      });

      // Sum up all loyalty points that were actually applied to bookings
      const actualRedeemed = bookings.reduce((sum, booking) => {
        // Only count non-cancelled bookings
        if (booking.status !== 'CANCELLED') {
          return sum + (booking.loyaltyPointsApplied || 0);
        }
        return sum;
      }, 0);

      console.log(`   Actual redeemed (from bookings): ${actualRedeemed}`);
      console.log(`   Total bookings: ${bookings.length}`);

      // Calculate earned points
      const earnedBookings = await prisma.booking.findMany({
        where: { userId: user.id },
        select: {
          payment: {
            select: {
              amountCents: true,
              status: true,
            },
          },
          cashCollected: true,
          cashAmountCents: true,
        },
      });

      const totalPaidCents = earnedBookings.reduce((sum, booking) => {
        const cardPaid = booking.payment?.status === 'PAID' ? (booking.payment.amountCents || 0) : 0;
        const cashPaid = booking.cashCollected ? (booking.cashAmountCents || 0) : 0;
        return sum + (cardPaid > 0 ? cardPaid : cashPaid);
      }, 0);

      const earnedPoints = Math.floor(totalPaidCents / 100); // Assuming 1 point per AED
      const availablePoints = Math.max(0, earnedPoints - actualRedeemed);

      console.log(`   Earned points: ${earnedPoints} (from ${(totalPaidCents / 100).toFixed(2)} AED)`);
      console.log(`   Available points: ${availablePoints}`);

      // Check if correction is needed
      if (user.loyaltyRedeemedPoints !== actualRedeemed) {
        console.log(`   ⚠️  Mismatch detected! Correcting ${user.loyaltyRedeemedPoints} → ${actualRedeemed}`);
        
        await prisma.user.update({
          where: { id: user.id },
          data: {
            loyaltyRedeemedPoints: actualRedeemed,
          },
        });

        console.log(`   ✅ Fixed!`);
      } else {
        console.log(`   ✅ Already correct`);
      }
    }

    console.log('\n\n✨ Loyalty points data integrity check complete!');
  } catch (error) {
    console.error('❌ Error fixing loyalty points:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixLoyaltyPoints()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
