import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    console.log("[business-hours] GET request received");

    // Get the active business hours
    const businessHours = await prisma.businessHours.findFirst({
      where: { isActive: true },
      include: {
        setBy: {
          select: { id: true, name: true }
        }
      },
      orderBy: { setAt: 'desc' }
    });

    console.log("[business-hours] Found business hours:", businessHours);

    return NextResponse.json({
      businessHours: businessHours ? {
        id: businessHours.id,
        startTime: businessHours.startTime,
        endTime: businessHours.endTime,
        durationHours: businessHours.durationHours,
        isActive: businessHours.isActive,
        setBy: businessHours.setBy,
        setAt: businessHours.setAt.toISOString(),
        notes: businessHours.notes
      } : null
    });
  } catch (error) {
    console.error("[business-hours] Error fetching business hours:", error);
    return NextResponse.json(
      { error: "Failed to fetch business hours", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("[business-hours] POST request received");

    const session = await getServerSession(authOptions);
    console.log("[business-hours] Session:", session);

    if (!session?.user?.id) {
      console.log("[business-hours] No session or user ID");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { startTime, endTime, durationHours, notes } = await request.json();
    console.log("[business-hours] Request data:", { startTime, endTime, durationHours, notes });

    if (!startTime || !endTime || !durationHours) {
      console.log("[business-hours] Missing required fields");
      return NextResponse.json(
        { error: "Start time, end time, and duration are required" },
        { status: 400 }
      );
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      console.log("[business-hours] Invalid time format");
      return NextResponse.json(
        { error: "Invalid time format. Use HH:MM format" },
        { status: 400 }
      );
    }

    // Validate duration
    if (durationHours < 1 || durationHours > 24) {
      console.log("[business-hours] Invalid duration");
      return NextResponse.json(
        { error: "Duration must be between 1 and 24 hours" },
        { status: 400 }
      );
    }

    console.log("[business-hours] Deactivating existing business hours");
    // Deactivate all existing business hours
    await prisma.businessHours.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    });

    console.log("[business-hours] Creating new business hours");
    // Create new business hours
    const newBusinessHours = await prisma.businessHours.create({
      data: {
        startTime,
        endTime,
        durationHours,
        isActive: true,
        setById: session.user.id,
        notes: notes || null
      },
      include: {
        setBy: {
          select: { id: true, name: true }
        }
      }
    });

    console.log("[business-hours] Created business hours:", newBusinessHours);

    return NextResponse.json({
      businessHours: {
        id: newBusinessHours.id,
        startTime: newBusinessHours.startTime,
        endTime: newBusinessHours.endTime,
        durationHours: newBusinessHours.durationHours,
        isActive: newBusinessHours.isActive,
        setBy: newBusinessHours.setBy,
        setAt: newBusinessHours.setAt.toISOString(),
        notes: newBusinessHours.notes
      }
    });
  } catch (error) {
    console.error("[business-hours] Error updating business hours:", error);
    return NextResponse.json(
      { error: "Failed to update business hours", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
