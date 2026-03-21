import { prisma } from "@/lib/prisma";
import { BookingsManagementClient } from "./BookingsManagementClient";

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  // Fetch all bookings with relations - now with full pricing fields
  const bookings = await prisma.booking.findMany({
    select: {
      id: true,
      createdAt: true,
      startAt: true,
      status: true,
      taskStatus: true,
      locationLabel: true,
      locationCoordinates: true,
      cashCollected: true,
      cashSettled: true,
      cashAmountCents: true,
      invoiceNumber: true,
      orderNumber: true,
      // Pricing fields for calculation
      servicePriceCents: true,
      serviceDiscountPercentage: true,
      couponDiscountCents: true,
      loyaltyCreditAppliedCents: true,
      taxPercentage: true,
      stripeFeePercentage: true,
      extraFeeCents: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Calculate final prices for each booking
  const enrichedBookings = bookings.map((booking) => {
    // Calculate final price including all discounts, fees, and loyalty points
    let finalPriceCents = 0;
    
    // Start with service price (use snapshot if available, otherwise 0)
    const servicePriceCents = booking.servicePriceCents || 0;
    finalPriceCents = servicePriceCents;
    
    // Apply service discount if available
    if (booking.serviceDiscountPercentage && booking.serviceDiscountPercentage > 0) {
      const discountAmount = Math.round(finalPriceCents * (booking.serviceDiscountPercentage / 100));
      finalPriceCents -= discountAmount;
    }
    
    // Apply coupon discount if available
    if (booking.couponDiscountCents && booking.couponDiscountCents > 0) {
      finalPriceCents -= booking.couponDiscountCents;
    }
    
    // Apply tax if configured
    if (booking.taxPercentage && booking.taxPercentage > 0) {
      const taxAmount = Math.round(finalPriceCents * (booking.taxPercentage / 100));
      finalPriceCents += taxAmount;
    }
    
    // Apply Stripe fee if configured
    if (booking.stripeFeePercentage && booking.stripeFeePercentage > 0) {
      const stripeFeeAmount = Math.round(finalPriceCents * (booking.stripeFeePercentage / 100));
      finalPriceCents += stripeFeeAmount;
    }
    
    // Apply extra fees if configured
    if (booking.extraFeeCents && booking.extraFeeCents > 0) {
      finalPriceCents += booking.extraFeeCents;
    }
    
    // Apply loyalty credit if available
    if (booking.loyaltyCreditAppliedCents && booking.loyaltyCreditAppliedCents > 0) {
      finalPriceCents -= booking.loyaltyCreditAppliedCents;
    }
    
    // Ensure price doesn't go below 0
    finalPriceCents = Math.max(0, finalPriceCents);

    // Calculate total discount amount
    const totalDiscountCents = (servicePriceCents + (booking.taxPercentage ? Math.round(servicePriceCents * (booking.taxPercentage / 100)) : 0) + (booking.stripeFeePercentage ? Math.round((servicePriceCents - (booking.couponDiscountCents || 0) - (booking.loyaltyCreditAppliedCents || 0)) * (booking.stripeFeePercentage / 100)) : 0) + (booking.extraFeeCents || 0)) - finalPriceCents;

    return {
      ...booking,
      // Add calculated final price for display
      calculatedFinalPriceCents: finalPriceCents,
      calculatedFinalPrice: (finalPriceCents / 100).toFixed(2),
      // Also provide the base price for comparison
      basePriceCents: servicePriceCents,
      basePrice: (servicePriceCents / 100).toFixed(2),
      // Discount information
      totalDiscountCents,
      hasDiscount: (booking.couponDiscountCents > 0) || (booking.loyaltyCreditAppliedCents > 0) || (booking.serviceDiscountPercentage !== null && booking.serviceDiscountPercentage > 0),
    };
  });

  // Fetch all drivers for assignment dropdown
  const drivers = await prisma.user.findMany({
    where: { role: "DRIVER" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <BookingsManagementClient bookings={enrichedBookings as any} drivers={drivers} />;
}
