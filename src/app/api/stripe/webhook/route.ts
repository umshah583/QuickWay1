import { NextResponse } from "next/server";
import stripe from "@/lib/stripe";
import prisma from "@/lib/prisma";
import Stripe from "stripe";
// import { notifyCustomerBookingUpdate } from "@/lib/notifications-v2";
import { publishLiveUpdate } from "@/lib/liveUpdates";
import { emitBusinessEvent } from "@/lib/business-events";

export async function POST(req: Request) {
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 });

  const text = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(text, sig, secret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = (session.metadata?.bookingId as string) || null;
        const paymentId = (session.metadata?.paymentId as string) || null;
        if (bookingId) {
          const booking = await prisma.booking.update({ 
            where: { id: bookingId }, 
            data: { status: "PAID" },
            select: { userId: true, service: { select: { name: true } } }
          });
          
          // Emit centralized business event for payment updated
          if (booking?.userId) {
            emitBusinessEvent('booking.payment_updated', {
              bookingId,
              userId: booking.userId,
              status: 'PAID',
              serviceName: booking.service?.name,
            });
          }

          // Broadcast to ALL clients (admin dashboard refresh)
          publishLiveUpdate(
            { type: 'bookings.updated', bookingId },
            undefined // No target = broadcast to all
          );
        }
        if (paymentId) {
          await prisma.payment.update({ where: { id: paymentId }, data: { status: "PAID" } });
        }
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentId = (session.metadata?.paymentId as string) || null;
        if (paymentId) {
          await prisma.payment.update({ where: { id: paymentId }, data: { status: "CANCELED" } });
        }
        break;
      }
      default:
        break;
    }
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unhandled webhook error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
