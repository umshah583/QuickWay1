import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import Stripe from "stripe";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

type PrismaWithBoth = typeof prisma & {
  monthlyPackage: {
    findUnique: (args: unknown) => Promise<any>;
  };
  subscriptionRequest: {
    findUnique: (args: unknown) => Promise<any>;
    update: (args: unknown) => Promise<any>;
  };
  packageSubscription: {
    create: (args: unknown) => Promise<any>;
  };
};

const db = prisma as PrismaWithBoth;

const confirmPaymentSchema = z.object({
  paymentIntentId: z.string().min(1),
});

/**
 * POST /api/subscription-requests/[id]/confirm-payment
 * After customer pays, confirm payment and create the actual subscription
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const parsed = confirmPaymentSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Payment intent ID is required", 400);
    }

    const { paymentIntentId } = parsed.data;

    // Initialize Stripe
    if (!process.env.STRIPE_SECRET_KEY) {
      return errorResponse("Stripe not configured", 500);
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-09-30.clover",
    });

    // Find the request
    const request = await db.subscriptionRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return errorResponse("Request not found", 404);
    }

    if (request.status !== "APPROVED") {
      return errorResponse("Request must be approved before payment", 400);
    }

    // Verify payment intent
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== "succeeded") {
      return errorResponse("Payment not completed", 400);
    }

    // Get package details
    const pkg = await db.monthlyPackage.findUnique({
      where: { id: request.packageId },
    });

    if (!pkg) {
      return errorResponse("Package not found", 400);
    }

    const amountPaid = intent.amount ?? pkg.priceCents;

    // Calculate subscription dates
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    // Create the actual subscription
    const subscription = await db.packageSubscription.create({
      data: {
        userId: request.userId,
        packageId: request.packageId,
        status: "ACTIVE",
        startDate,
        endDate,
        washesRemaining: pkg.washesPerMonth,
        washesUsed: 0,
        pricePaidCents: amountPaid,
        paymentId: paymentIntentId,
        preferredWashDates: request.scheduleDates,
        vehicleMake: request.vehicleMake,
        vehicleModel: request.vehicleModel,
        vehicleColor: request.vehicleColor,
        vehicleType: request.vehicleType,
        vehiclePlate: request.vehiclePlate,
        locationLabel: request.locationLabel,
        locationCoordinates: request.locationCoordinates,
        autoRenew: true,
      },
    });

    // Mark request as COMPLETED
    await db.subscriptionRequest.update({
      where: { id },
      data: {
        status: "COMPLETED",
        paymentIntentId,
        subscriptionId: subscription.id,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Payment confirmed. Subscription is now active!",
      subscriptionId: subscription.id,
    });
  } catch (error) {
    console.error("Error confirming payment:", error);
    return errorResponse("Failed to confirm payment", 500);
  }
}
