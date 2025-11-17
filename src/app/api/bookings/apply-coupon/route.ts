import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { applyCouponToBooking, CouponError, removeCouponFromBooking } from "@/lib/coupons";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";

export function OPTIONS() {
  return noContentResponse("POST,DELETE,OPTIONS");
}

async function resolveUserId(req: Request): Promise<string | null> {
  const mobileUser = await getMobileUserFromRequest(req);
  if (mobileUser) return mobileUser.sub;

  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return (session.user as { id: string }).id;
}

export async function POST(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return errorResponse("Unauthorized", 401);
  }

  const body = await req.json().catch(() => null);
  const bookingId = typeof body?.bookingId === "string" ? body.bookingId : null;
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (!bookingId) {
    return errorResponse("Missing bookingId", 400);
  }
  if (!code) {
    return errorResponse("Enter a coupon code", 400);
  }

  try {
    const result = await applyCouponToBooking({ bookingId, userId, code });
    return jsonResponse(result);
  } catch (error: unknown) {
    if (error instanceof CouponError) {
      return errorResponse(error.message, error.status);
    }
    console.error("Apply coupon error", error);
    return errorResponse("Unable to apply coupon", 500);
  }
}

export async function DELETE(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return errorResponse("Unauthorized", 401);
  }

  const body = await req.json().catch(() => null);
  const bookingId = typeof body?.bookingId === "string" ? body.bookingId : null;

  if (!bookingId) {
    return errorResponse("Missing bookingId", 400);
  }

  try {
    const result = await removeCouponFromBooking({ bookingId, userId });
    return jsonResponse(result);
  } catch (error: unknown) {
    if (error instanceof CouponError) {
      return errorResponse(error.message, error.status);
    }
    console.error("Remove coupon error", error);
    return errorResponse("Unable to remove coupon", 500);
  }
}
