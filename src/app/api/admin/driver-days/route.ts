import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // OPEN, CLOSED, or null for all
    const date = searchParams.get('date'); // Filter by specific date

    // Build where clause
    const where: {
      status?: 'OPEN' | 'CLOSED';
      date?: Date;
    } = {};
    if (status && (status === 'OPEN' || status === 'CLOSED')) {
      where.status = status as 'OPEN' | 'CLOSED';
    }
    if (date) {
      where.date = new Date(date);
    }

    const driverDays = await prisma.driverDay.findMany({
      where,
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      },
      orderBy: [
        { date: 'desc' },
        { startedAt: 'desc' }
      ]
    });

    // Get current active drivers (OPEN status today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeToday = await prisma.driverDay.count({
      where: {
        date: today,
        status: 'OPEN'
      }
    });

    return NextResponse.json({
      driverDays,
      activeToday,
      totalDays: driverDays.length
    });
  } catch (error) {
    console.error("Error fetching driver days:", error);
    return NextResponse.json(
      { error: "Failed to fetch driver days" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { driverDayId, action } = await request.json();

    if (!driverDayId || !action) {
      return NextResponse.json(
        { error: "driverDayId and action are required" },
        { status: 400 }
      );
    }

    if (action !== 'reset_end') {
      return NextResponse.json(
        { error: "Invalid action. Only 'reset_end' is supported" },
        { status: 400 }
      );
    }

    // Find the driver day
    const driverDay = await prisma.driverDay.findUnique({
      where: { id: driverDayId }
    });

    if (!driverDay) {
      return NextResponse.json(
        { error: "Driver day not found" },
        { status: 404 }
      );
    }

    if (driverDay.status !== 'CLOSED') {
      return NextResponse.json(
        { error: "Can only reset ended days" },
        { status: 400 }
      );
    }

    // Reset the day to OPEN status and clear end-related fields
    const updatedDriverDay = await prisma.driverDay.update({
      where: { id: driverDayId },
      data: {
        status: 'OPEN',
        endedAt: null,
        endNotes: null,
        cashSettledCents: 0, // Reset settled amount, keep collected
      },
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: "Driver day end has been reset. Driver can now start a new shift.",
      driverDay: updatedDriverDay
    });
  } catch (error) {
    console.error("Error managing driver day:", error);
    return NextResponse.json(
      { error: "Failed to manage driver day" },
      { status: 500 }
    );
  }
}
