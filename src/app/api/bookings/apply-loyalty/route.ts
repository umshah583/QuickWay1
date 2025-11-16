import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { fetchLoyaltySettings } from "@/lib/loyalty";
import { calculateDiscountedPrice } from "@/lib/pricing";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const body = await req.json().catch(() => null);
  const bookingId = body?.bookingId as string | undefined;
  const pointsToUse = Number.parseInt(body?.points?.toString() ?? "", 10);

  if (!bookingId) {
    return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });
  }
  if (!Number.isFinite(pointsToUse) || pointsToUse <= 0) {
    return NextResponse.json({ error: "Invalid points" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      userId: true,
      status: true,
      loyaltyCreditAppliedCents: true,
      loyaltyPointsApplied: true,
      service: { select: { priceCents: true, discountPercentage: true } },
    },
  });
  if (!booking || booking.userId !== userId) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.status !== "PENDING") {
    return NextResponse.json({ error: "Cannot apply points to this booking" }, { status: 400 });
  }
  if ((booking.loyaltyPointsApplied ?? 0) > 0) {
    return NextResponse.json({ error: "Points already applied to this booking" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { loyaltyRedeemedPoints: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const settings = await fetchLoyaltySettings();
  const availablePoints = await computeAvailablePoints(userId, user.loyaltyRedeemedPoints ?? 0, settings.pointsPerAed);

  if (pointsToUse > availablePoints) {
    return NextResponse.json({ error: "Not enough points" }, { status: 400 });
  }

  const { pointsPerAed } = settings;
  const pointValueCents = pointsPerAed > 0 ? Math.floor((pointsToUse * 100) / pointsPerAed) : pointsToUse;
  if (pointValueCents <= 0) {
    return NextResponse.json({ error: "Points too low to redeem" }, { status: 400 });
  }

  const basePrice = booking.service.priceCents;
  const discount = booking.service.discountPercentage ?? 0;
  const discountedPrice = calculateDiscountedPrice(basePrice, discount);
  const creditToApply = Math.min(pointValueCents, discountedPrice);
  const remainingPrice = Math.max(0, discountedPrice - creditToApply);

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: {
        loyaltyCreditAppliedCents: creditToApply,
        loyaltyPointsApplied: pointsToUse,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        loyaltyRedeemedPoints: {
          increment: pointsToUse,
        },
      },
    }),
  ]);

  return NextResponse.json({
    remainingAmountCents: remainingPrice,
    pointsUsed: pointsToUse,
    creditAppliedCents: creditToApply,
  });
}

async function computeAvailablePoints(userId: string, redeemedPoints: number, pointsPerAed: number) {
  const bookings = await prisma.booking.findMany({
    where: {
      userId,
      OR: [{ status: "PAID" }, { cashCollected: true }],
    },
    select: {
      payment: { select: { amountCents: true, status: true } },
      cashCollected: true,
      cashAmountCents: true,
    },
  });

  const totalPaid = bookings.reduce((sum, booking) => {
    const payment = booking.payment?.status === "PAID" ? booking.payment.amountCents : 0;
    const cash = booking.cashCollected ? booking.cashAmountCents ?? 0 : 0;
    return sum + payment + cash;
  }, 0);

  const totalPointsEarned = pointsPerAed > 0 ? Math.floor((totalPaid / 100) * pointsPerAed) : 0;
  return Math.max(0, totalPointsEarned - redeemedPoints);
}
