import { NextResponse } from "next/server";
import stripe from "@/lib/stripe";
import prisma from "@/lib/prisma";
import Stripe from "stripe";
import { notifyCustomerBookingUpdate } from "@/lib/notifications-v2";

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
          
          // Notify CUSTOMER about successful payment
          if (booking?.userId) {
            void notifyCustomerBookingUpdate(
              booking.userId,
              bookingId,
              'Payment Successful',
              `Your payment for ${booking.service?.name ?? 'your booking'} has been confirmed.`
            );
          }
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
