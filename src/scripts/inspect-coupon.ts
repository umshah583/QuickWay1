import prisma from "@/lib/prisma";

async function main() {
  // Check the most recent bookings with coupon data
  const bookings = await prisma.booking.findMany({
    where: {
      OR: [
        { couponCode: { not: null } },
        { couponDiscountCents: { gt: 0 } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      status: true,
      couponCode: true,
      couponId: true,
      couponDiscountCents: true,
      cashAmountCents: true,
      loyaltyCreditAppliedCents: true,
      service: {
        select: {
          name: true,
          priceCents: true,
          discountPercentage: true,
        },
      },
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  console.log("\n=== Bookings with Coupons ===");
  console.log(`Found ${bookings.length} booking(s) with coupon data\n`);

  if (bookings.length === 0) {
    console.log("No bookings found with coupons applied.");
    console.log("\nTrying to find ANY recent booking...");
    
    const recentBooking = await prisma.booking.findFirst({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        couponCode: true,
        couponId: true,
        couponDiscountCents: true,
        cashAmountCents: true,
        loyaltyCreditAppliedCents: true,
        service: {
          select: {
            name: true,
            priceCents: true,
            discountPercentage: true,
          },
        },
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (recentBooking) {
      console.log("\nMost recent booking:");
      console.log(JSON.stringify(recentBooking, null, 2));
    }
  } else {
    for (const booking of bookings) {
      console.log(`Booking ID: ${booking.id}`);
      console.log(`User: ${booking.user.email}`);
      console.log(`Service: ${booking.service.name} (${booking.service.priceCents} fils)`);
      console.log(`Service discount: ${booking.service.discountPercentage ?? 0}%`);
      console.log(`Coupon code: ${booking.couponCode ?? "none"}`);
      console.log(`Coupon discount: ${booking.couponDiscountCents} fils`);
      console.log(`Loyalty credit: ${booking.loyaltyCreditAppliedCents ?? 0} fils`);
      console.log(`Cash amount: ${booking.cashAmountCents ?? "not set"} fils`);
      console.log(`Status: ${booking.status}`);
      console.log("---");
    }
  }

  // Check available coupons
  const coupons = await prisma.coupon.findMany({
    where: { active: true },
    select: {
      code: true,
      discountType: true,
      discountValue: true,
      active: true,
      validFrom: true,
      validUntil: true,
    },
    take: 10,
  });

  console.log("\n=== Active Coupons ===");
  console.log(`Found ${coupons.length} active coupon(s)\n`);
  for (const coupon of coupons) {
    console.log(`Code: ${coupon.code}`);
    console.log(`Type: ${coupon.discountType}, Value: ${coupon.discountValue}`);
    console.log(`Valid from: ${coupon.validFrom ?? "always"}`);
    console.log(`Valid until: ${coupon.validUntil ?? "forever"}`);
    console.log("---");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
