import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { applyCouponToBooking, CouponError, removeCouponFromBooking } from "@/lib/coupons";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const body = await req.json().catch(() => null);
  const bookingId = typeof body?.bookingId === "string" ? body.bookingId : null;
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (!bookingId) {
    return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ error: "Enter a coupon code" }, { status: 400 });
  }

  try {
    const result = await applyCouponToBooking({ bookingId, userId, code });
    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof CouponError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Apply coupon error", error);
    return NextResponse.json({ error: "Unable to apply coupon" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const body = await req.json().catch(() => null);
  const bookingId = typeof body?.bookingId === "string" ? body.bookingId : null;

  if (!bookingId) {
    return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });
  }

  try {
    const result = await removeCouponFromBooking({ bookingId, userId });
    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof CouponError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Remove coupon error", error);
    return NextResponse.json({ error: "Unable to remove coupon" }, { status: 500 });
  }
}
