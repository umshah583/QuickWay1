import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import stripe from "@/lib/stripe";
import { getAdminSettingsClient } from "@/app/admin/settings/adminSettingsClient";
import { FREE_WASH_EVERY_N_BOOKINGS_SETTING_KEY } from "@/app/admin/settings/pricingConstants";
import { applyCouponAndCredits } from "@/lib/pricing";
import { loadPricingAdjustmentConfig } from "@/lib/pricingSettings";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });

  const body = await req.json().catch(() => null);
  const bookingId = body?.bookingId as string | undefined;
  if (!bookingId) return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      userId: true,
      status: true,
      service: { select: { id: true, name: true, description: true, priceCents: true, discountPercentage: true } },
      loyaltyCreditAppliedCents: true,
      loyaltyPointsApplied: true,
      couponDiscountCents: true,
      couponCode: true,
    },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  const userId = (session.user as { id: string }).id;
  if (booking.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (booking.status !== "PENDING") return NextResponse.json({ error: "Booking not payable" }, { status: 400 });

  const basePriceCents = booking.service.priceCents;
  const discount = booking.service.discountPercentage ?? 0;
  const couponDiscountCents = booking.couponDiscountCents ?? 0;
  const loyaltyCreditCents = booking.loyaltyCreditAppliedCents ?? 0;

  const pricingAdjustments = await loadPricingAdjustmentConfig();

  const priceAfterAdjustments = applyCouponAndCredits(
    basePriceCents,
    discount,
    couponDiscountCents,
    loyaltyCreditCents,
    pricingAdjustments,
  );

  const freeWashInterval = await loadFreeWashInterval();
  const qualifiesForFreeWash = freeWashInterval
    ? await isNextWashFree(userId, booking.id, freeWashInterval)
    : false;

  const effectivePriceCents = qualifiesForFreeWash ? 0 : priceAfterAdjustments;

  if (effectivePriceCents === 0 && (booking.loyaltyPointsApplied ?? 0) > 0 && loyaltyCreditCents > 0) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        loyaltyCreditConsumed: true,
      },
    });
  }

  if (effectivePriceCents === 0) {
    await prisma.payment.upsert({
      where: { bookingId: booking.id },
      update: { status: "PAID", amountCents: 0, provider: "STRIPE", sessionId: null },
      create: {
        bookingId: booking.id,
        provider: "STRIPE",
        status: "PAID",
        amountCents: 0,
      },
    });

    await prisma.booking.update({ where: { id: booking.id }, data: { status: "PAID" } });

    return NextResponse.json({ free: true }, { status: 200 });
  }

  const payment = await prisma.payment.upsert({
    where: { bookingId: booking.id },
    update: { status: "REQUIRES_PAYMENT", amountCents: effectivePriceCents, provider: "STRIPE" },
    create: {
      bookingId: booking.id,
      provider: "STRIPE",
      status: "REQUIRES_PAYMENT",
      amountCents: effectivePriceCents,
    },
  });

  const origin = req.headers.get("origin") ?? "http://localhost:3000";

  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "aed",
          product_data: { name: booking.service.name, description: booking.service.description ?? undefined },
          unit_amount: effectivePriceCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/account?paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/account?canceled=1`,
    metadata: { bookingId: booking.id, paymentId: payment.id },
  });

  await prisma.payment.update({ where: { id: payment.id }, data: { sessionId: checkout.id } });

  return NextResponse.json({ url: checkout.url }, { status: 200 });
}

async function loadFreeWashInterval(): Promise<number | null> {
  const client = getAdminSettingsClient();
  if (!client) return null;

  const rows = await client.findMany();
  const record = rows.find((row) => row.key === FREE_WASH_EVERY_N_BOOKINGS_SETTING_KEY);
  if (!record?.value) return null;

  const parsed = Number.parseInt(record.value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

async function isNextWashFree(userId: string, bookingId: string, interval: number): Promise<boolean> {
  if (interval <= 0) return false;

  const completedCount = await prisma.booking.count({
    where: {
      userId,
      id: { not: bookingId },
      OR: [{ status: "PAID" }, { cashSettled: true }],
    },
  });

  return (completedCount + 1) % interval === 0;
}
