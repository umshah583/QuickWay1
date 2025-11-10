import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";

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
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }
  const userId = (session.user as { id: string }).id;
  const body = await req.json().catch(() => null);
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return errorResponse(message, 400);
  }
  const { serviceId, startAt, locationLabel, locationCoordinates, vehicleMake, vehicleModel, vehicleColor, vehicleType, vehiclePlate } = parsed.data;
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

  return jsonResponse({ id: booking.id }, { status: 201 });
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }
  const userId = (session.user as { id: string }).id;

  const url = new URL(req.url ?? "http://localhost");
  const statusParam = url.searchParams.get("status");
  const take = Math.min(Number(url.searchParams.get("limit") ?? 20), 50);
  const cursor = url.searchParams.get("cursor") ?? undefined;

  const where: Parameters<typeof prisma.booking.findMany>[0]["where"] = {
    userId,
  };
  if (statusParam) {
    where.status = statusParam as any;
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
