import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import stripe from "@/lib/stripe";

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
      service: { select: { id: true, name: true, description: true, priceCents: true } },
    },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  const userId = (session.user as { id: string }).id;
  if (booking.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (booking.status !== "PENDING") return NextResponse.json({ error: "Booking not payable" }, { status: 400 });

  const payment = await prisma.payment.upsert({
    where: { bookingId: booking.id },
    update: { status: "REQUIRES_PAYMENT", amountCents: booking.service.priceCents, provider: "STRIPE" },
    create: {
      bookingId: booking.id,
      provider: "STRIPE",
      status: "REQUIRES_PAYMENT",
      amountCents: booking.service.priceCents,
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
          unit_amount: booking.service.priceCents,
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
