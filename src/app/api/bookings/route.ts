import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { z } from "zod";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";
import stripe from "@/lib/stripe";
import type { BookingStatus, Prisma, PaymentProvider, PaymentStatus } from "@prisma/client";

const bookingSchema = z.object({
  serviceId: z.string().min(1, "Select a service"),
  startAt: z.string().min(1, "Select a start time"),
  locationLabel: z.string().trim().max(120).optional(),
  locationCoordinates: z.string().trim().max(256).optional(),
  vehicleMake: z.string().trim().max(60).optional(),
  vehicleModel: z.string().trim().max(60).optional(),
  vehicleColor: z.string().trim().max(60).optional(),
  vehicleType: z.string().trim().max(60).optional(),
  vehiclePlate: z.string().trim().max(32).optional(),
  paymentMethod: z.enum(["cash", "card"]).optional(),
  paymentIntentId: z.string().trim().optional(),
});

const bookingStatusSchema = z.enum(["PENDING", "PAID", "CANCELLED"]);

export async function POST(req: Request) {
  const mobileUser = await getMobileUserFromRequest(req);
  let userId: string | null = null;

  if (mobileUser) {
    userId = mobileUser.sub;
  } else {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse("Unauthorized", 401);
    }
    userId = (session.user as { id: string }).id;
  }

  const body = await req.json().catch(() => null);
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return errorResponse(message, 400);
  }
  const {
    serviceId,
    startAt,
    locationLabel,
    locationCoordinates,
    vehicleMake,
    vehicleModel,
    vehicleColor,
    vehicleType,
    vehiclePlate,
    paymentMethod: rawPaymentMethod,
    paymentIntentId,
  } = parsed.data;
  const paymentMethod = rawPaymentMethod ?? "cash";
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || !service.active) {
    return errorResponse("Invalid service", 400);
  }
  const start = new Date(startAt);
  if (isNaN(start.getTime())) {
    return errorResponse("Invalid date", 400);
  }
  const end = new Date(start.getTime() + service.durationMin * 60000);

  const overlap = await prisma.booking.findFirst({
    where: {
      serviceId,
      status: { in: ["PENDING", "PAID"] },
      startAt: { lt: end },
      endAt: { gt: start },
    },
  });
  if (overlap) {
    return errorResponse("Selected slot is not available", 409);
  }

  const booking = await prisma.booking.create({
    data: {
      userId,
      serviceId,
      startAt: start,
      endAt: end,
      status: "PENDING",
      locationLabel: locationLabel ?? null,
      locationCoordinates: locationCoordinates ?? null,
      vehicleMake: vehicleMake ?? null,
      vehicleModel: vehicleModel ?? null,
      vehicleColor: vehicleColor ?? null,
      vehicleType: vehicleType ?? null,
      vehiclePlate: vehiclePlate ?? null,
    },
  });

  if (paymentMethod === "card") {
    if (!paymentIntentId) {
      return jsonResponse(
        { id: booking.id, requiresPayment: true, status: booking.status },
        { status: 202 },
      );
    }

    if (!stripe) {
      await prisma.booking.delete({ where: { id: booking.id } });
      return errorResponse("Unable to process payment. Please try again later.", 500);
    }

    try {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (intent.status !== "succeeded") {
        await prisma.booking.delete({ where: { id: booking.id } });
        return errorResponse("Your booking failed due to payment issue.", 400);
      }

      await prisma.booking.update({ where: { id: booking.id }, data: { status: "PAID" } });

      await prisma.payment.upsert({
        where: { bookingId: booking.id },
        create: {
          bookingId: booking.id,
          provider: "STRIPE" as PaymentProvider,
          status: "PAID" as PaymentStatus,
          amountCents: intent.amount ?? 0,
          sessionId: intent.id,
        },
        update: {
          status: "PAID" as PaymentStatus,
          amountCents: intent.amount ?? 0,
          sessionId: intent.id,
        },
      });
    } catch {
      await prisma.booking.delete({ where: { id: booking.id } });
      return errorResponse("Your booking failed due to payment issue.", 400);
    }
  }

  return jsonResponse({ id: booking.id, requiresPayment: false, status: booking.status }, { status: 201 });
}

export async function GET(req: Request) {
  const mobileUser = await getMobileUserFromRequest(req);
  let userId: string | null = null;

  if (mobileUser) {
    userId = mobileUser.sub;
  } else {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse("Unauthorized", 401);
    }
    userId = (session.user as { id: string }).id;
  }

  const url = new URL(req.url ?? "http://localhost");
  const statusParam = url.searchParams.get("status");
  const take = Math.min(Number(url.searchParams.get("limit") ?? 20), 50);
  const cursor = url.searchParams.get("cursor") ?? undefined;

  let statusFilter: BookingStatus | undefined;
  if (statusParam) {
    const parsedStatus = bookingStatusSchema.safeParse(statusParam.toUpperCase());
    if (!parsedStatus.success) {
      return errorResponse("Invalid status filter", 400);
    }
    statusFilter = parsedStatus.data;
  }

  const where: Prisma.BookingWhereInput = {
    userId,
  };
  if (statusFilter) {
    where.status = statusFilter;
  }

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { startAt: "desc" },
    take: take + 1,
    cursor: cursor ? { id: cursor } : undefined,
    include: {
      service: true,
      payment: true,
    },
  });

  let nextCursor: string | null = null;
  if (bookings.length > take) {
    const nextItem = bookings.pop();
    nextCursor = nextItem?.id ?? null;
  }

  return jsonResponse({ data: bookings, nextCursor });
}

export function OPTIONS() {
  return noContentResponse();
}
