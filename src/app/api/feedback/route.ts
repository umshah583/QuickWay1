import { z } from "zod";
import prisma from "@/lib/prisma";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { jsonResponse, errorResponse, noContentResponse } from "@/lib/api-response";

const feedbackSchema = z.object({
  bookingId: z.string().trim().min(1, "Missing booking reference"),
  message: z.string().trim().min(1, "Feedback message is required"),
  rating: z.number().int().min(1).max(5).optional(),
});

export async function OPTIONS() {
  return noContentResponse("POST,OPTIONS");
}

export async function POST(req: Request) {
  const user = await getMobileUserFromRequest(req);
  if (!user) {
    return errorResponse("Unauthorized", 401);
  }

  const body = await req.json().catch(() => null);
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid feedback";
    return errorResponse(message, 400);
  }

  const { bookingId, message, rating } = parsed.data;

  // Verify booking belongs to this user and fetch driver
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId: user.sub },
    select: { id: true, driverId: true, serviceId: true },
  });

  if (!booking) {
    return errorResponse("Booking not found", 404);
  }

  const feedback = await prisma.feedback.create({
    data: {
      userId: user.sub,
      bookingId: booking.id,
      driverId: booking.driverId,
      serviceId: booking.serviceId,
      message,
      rating: rating ?? null,
      read: false,
    },
  });

  return jsonResponse({
    id: feedback.id,
    receivedAt: feedback.createdAt.toISOString(),
  });
}
