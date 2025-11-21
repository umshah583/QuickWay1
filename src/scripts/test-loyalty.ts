
import prisma from "@/lib/prisma";
import { calculateBookingPricing } from "@/lib/booking-pricing";

async function testLoyaltyDeduction() {
  console.log("Starting Loyalty Deduction Test...");

  // 1. Get a test user
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error("No user found!");
    return;
  }
  console.log(`Test User: ${user.email} (${user.id})`);
  console.log(`Initial Redeemed Points: ${user.loyaltyRedeemedPoints}`);

  // 2. Get a service
  const service = await prisma.service.findFirst({ where: { active: true } });
  if (!service) {
    console.error("No active service found!");
    return;
  }
  console.log(`Test Service: ${service.name} (${service.id})`);

  // 3. Simulate Booking Logic (mimicking the route.ts logic)
  const loyaltyPointsToApply = 10;
  console.log(`Attempting to apply ${loyaltyPointsToApply} points...`);

  try {
    // a. Pricing Calculation
    const pricing = await calculateBookingPricing({
      userId: user.id,
      serviceId: service.id,
      loyaltyPoints: loyaltyPointsToApply,
      couponCode: undefined,
      bookingId: null,
    });
    
    console.log("Pricing Result:", {
      applied: pricing.loyaltyPointsApplied,
      credit: pricing.loyaltyCreditAppliedCents,
    });

    if (pricing.loyaltyPointsApplied > 0) {
        // b. Deduct Points (Update User)
        console.log("Updating user record...");
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: {
                loyaltyRedeemedPoints: {
                    increment: pricing.loyaltyPointsApplied
                }
            }
        });
        console.log(`User Updated. New Redeemed Points: ${updatedUser.loyaltyRedeemedPoints}`);
        
        // c. Revert (Cleanup)
        console.log("Reverting changes for cleanup...");
        await prisma.user.update({
            where: { id: user.id },
            data: {
                loyaltyRedeemedPoints: {
                    decrement: pricing.loyaltyPointsApplied
                }
            }
        });
        console.log("Cleanup done.");
    } else {
        console.log("Points were not applied by pricing logic (maybe insufficient balance?)");
    }

  } catch (error) {
    console.error("Test Failed:", error);
  }
}

testLoyaltyDeduction()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
