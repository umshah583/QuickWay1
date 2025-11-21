import prisma from "@/lib/prisma";
import { computeLoyaltySummary } from "@/lib/loyalty";

async function run() {
  console.log("--- Loyalty Inspection ---");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      phoneNumber: true,
      loyaltyRedeemedPoints: true,
      loyaltyCreditCents: true,
    },
  });

  for (const user of users) {
    console.log("\nUser:", user.email ?? user.phoneNumber ?? user.id);
    console.log("  ID:", user.id);
    console.log("  RedeemedPoints (raw):", user.loyaltyRedeemedPoints);
    console.log("  CreditCents (raw):", user.loyaltyCreditCents);

    try {
      const summary = await computeLoyaltySummary(user.id);
      console.log("  Summary.totalPointsEarned:", summary.totalPointsEarned);
      console.log("  Summary.pointsRedeemed:", summary.pointsRedeemed);
      console.log("  Summary.availablePoints:", summary.availablePoints);
      console.log("  Summary.availableCreditCents:", summary.availableCreditCents);
    } catch (error) {
      console.error("  Failed to compute summary: ", error);
    }
  }

  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
});
