import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { id: string; role?: string };
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date"); // YYYY-MM-DD format
  const filterParam = searchParams.get("filter"); // "all" | "settled" | "unsettled"

  let dateFilter = {};
  if (dateParam) {
    const date = new Date(dateParam);
    if (!isNaN(date.getTime())) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      // Filter by collection date (taskCompletedAt) instead of booking date
      dateFilter = {
        taskCompletedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      };
    }
  }

  let settlementFilter = {};
  if (filterParam === "settled") {
    settlementFilter = { cashSettled: true };
  } else if (filterParam === "unsettled") {
    settlementFilter = { cashSettled: false };
  }

  const bookings = await prisma.booking.findMany({
    where: {
      cashCollected: true,
      ...dateFilter,
      ...settlementFilter,
    },
    orderBy: { startAt: "desc" },
    select: {
      id: true,
      startAt: true,
      taskCompletedAt: true,
      cashAmountCents: true,
      cashCollected: true,
      cashSettled: true,
      User_Booking_driverIdToUser: { select: { id: true, name: true, email: true } },
      Service: { select: { name: true, priceCents: true } },
      User_Booking_userIdToUser: { select: { id: true, name: true, email: true } },
      Payment: { select: { id: true } },
    },
  });

  // Calculate totals
  let totalCollectedCents = 0;
  let totalSettledCents = 0;
  let totalUnsettledCents = 0;

  for (const booking of bookings) {
    const amount = booking.cashAmountCents ?? booking.Service?.priceCents ?? 0;
    totalCollectedCents += amount;
    if (booking.cashSettled) {
      totalSettledCents += amount;
    } else {
      totalUnsettledCents += amount;
    }
  }

  // Group by driver
  const driverSummaries = new Map<
    string,
    {
      id: string;
      name: string;
      email: string;
      jobs: number;
      collected: number;
      settled: number;
      unsettled: number;
      lastJobDate?: string;
    }
  >();

  for (const booking of bookings) {
    const driverKey = booking.User_Booking_driverIdToUser?.id ?? "unassigned";
    const driverName = booking.User_Booking_driverIdToUser?.name || booking.User_Booking_driverIdToUser?.email || "Unassigned";
    const driverEmail = booking.User_Booking_driverIdToUser?.email ?? "";
    const amount = booking.cashAmountCents ?? booking.Service?.priceCents ?? 0;

    if (!driverSummaries.has(driverKey)) {
      driverSummaries.set(driverKey, {
        id: driverKey,
        name: driverName,
        email: driverEmail,
        jobs: 0,
        collected: 0,
        settled: 0,
        unsettled: 0,
        lastJobDate: undefined,
      });
    }

    const summary = driverSummaries.get(driverKey)!;
    summary.jobs += 1;
    summary.collected += amount;
    if (booking.cashSettled) {
      summary.settled += amount;
    } else {
      summary.unsettled += amount;
    }

    const bookingDate = booking.startAt.toISOString();
    if (!summary.lastJobDate || bookingDate > summary.lastJobDate) {
      summary.lastJobDate = bookingDate;
    }
  }

  return NextResponse.json({
    bookings: bookings.map((b) => ({
      id: b.id,
      startAt: b.startAt.toISOString(),
      taskCompletedAt: b.taskCompletedAt?.toISOString() ?? null,
      cashAmountCents: b.cashAmountCents,
      cashCollected: b.cashCollected,
      cashSettled: b.cashSettled,
      service: b.Service ? { name: b.Service.name, priceCents: b.Service.priceCents } : null,
      driver: b.User_Booking_driverIdToUser ? { id: b.User_Booking_driverIdToUser.id, name: b.User_Booking_driverIdToUser.name, email: b.User_Booking_driverIdToUser.email } : null,
      user: b.User_Booking_userIdToUser ? { id: b.User_Booking_userIdToUser.id, name: b.User_Booking_userIdToUser.name, email: b.User_Booking_userIdToUser.email } : null,
      payment: b.Payment ? { id: b.Payment.id } : null,
    })),
    totals: {
      collected: totalCollectedCents,
      settled: totalSettledCents,
      unsettled: totalUnsettledCents,
      count: bookings.length,
    },
    driverSummaries: Array.from(driverSummaries.values()),
  });
}
