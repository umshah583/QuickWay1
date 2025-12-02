import { z } from "zod";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { calculateBookingPricing, PricingError, CouponError } from "@/lib/booking-pricing";

const previewSchema = z.object({
  serviceId: z.string().min(1, "Service is required"),
  couponCode: z.string().trim().max(64).optional(),
  loyaltyPoints: z.number().int().min(0).optional(),
  bookingId: z.string().trim().optional(),
  vehicleCount: z.number().int().min(1).optional(),
  servicePriceCentsOverride: z.number().int().min(0).optional(),
});

export async function OPTIONS() {
  return noContentResponse("POST,OPTIONS");
}

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
    userId = (session.user as { id?: string }).id ?? null;
  }

  if (!userId) {
    return errorResponse("Unauthorized", 401);
  }

  const body = await req.json().catch(() => null);
  const parsed = previewSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return errorResponse(message, 400);
  }

  const { serviceId, couponCode, loyaltyPoints, bookingId, vehicleCount, servicePriceCentsOverride } = parsed.data;

  try {
    const pricing = await calculateBookingPricing({
      userId,
      serviceId,
      couponCode: couponCode?.trim() || undefined,
      loyaltyPoints: loyaltyPoints ?? undefined,
      bookingId: bookingId ?? null,
      vehicleCount: vehicleCount ?? null,
      servicePriceCentsOverride: servicePriceCentsOverride ?? null,
    });

    return jsonResponse(pricing);
  } catch (error: unknown) {
    if (error instanceof PricingError || error instanceof CouponError) {
      return errorResponse(error.message, error.status);
    }

    console.error("[bookings/preview]", error);
    return errorResponse("Unable to calculate pricing", 500);
  }
}
