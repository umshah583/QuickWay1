import { NextRequest, NextResponse } from "next/server";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  console.log(`[Driver Day API] GET request received: ${request.url}`);

  try {
    // Verify driver authentication
    const session = await getMobileUserFromRequest(request);
    console.log(`[Driver Day API] GET Session:`, { sub: session?.sub, role: session?.role });

    if (!session || session.role !== "DRIVER") {
      console.log(`[Driver Day API] GET Authentication failed`);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const driverId = session.sub;
    console.log(`[Driver Day API] GET Authenticated driver: ${driverId}`);

    // Simple connectivity test
    if (request.url.includes('test=true')) {
      console.log(`[Driver Day API] Connectivity test successful for driver ${driverId}`);
      return NextResponse.json({
        success: true,
        message: "API connectivity test successful",
        driverId: driverId,
        timestamp: new Date().toISOString()
      });
    }

    // Status check for debugging
    if (request.url.includes('status=true')) {
      console.log(`[Driver Day API] Status check requested for driver ${driverId}`);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const driverDay = await prisma.driverDay.findUnique({
        where: {
          driverId_date: {
            driverId: driverId,
            date: today
          }
        }
      });

      console.log(`[Driver Day API] Status check result:`, driverDay);

      return NextResponse.json({
        hasActiveDay: !!driverDay && driverDay.status === 'OPEN',
        driverDay: driverDay ? {
          id: driverDay.id,
          status: driverDay.status,
          date: driverDay.date.toISOString(),
          startedAt: driverDay.startedAt.toISOString(),
          endedAt: driverDay.endedAt?.toISOString()
        } : null,
        currentDate: today.toISOString(),
        driverId: driverId
      });
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    // Get today's date if no date provided
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    // Find the driver's current day
    const driverDay = await prisma.driverDay.findUnique({
      where: {
        driverId_date: {
          driverId: driverId,
          date: targetDate
        }
      }
    });

    if (!driverDay) {
      return NextResponse.json({
        driverDay: null,
        message: "No shift started for this date"
      });
    }

    // Get tasks completed today
    const tasksCompleted = await prisma.booking.count({
      where: {
        driverId: driverId,
        taskStatus: "COMPLETED",
        taskCompletedAt: {
          gte: targetDate,
          lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
        }
      }
    });

    // Get tasks in progress
    const tasksInProgress = await prisma.booking.count({
      where: {
        driverId: driverId,
        taskStatus: "IN_PROGRESS",
        taskStartedAt: {
          gte: targetDate,
          lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
        }
      }
    });

    // Get unsettled cash collections for this shift
    const unsettledCollections = await prisma.booking.findMany({
      where: {
        driverId: driverId,
        cashCollected: true,
        cashSettled: false,
        taskCompletedAt: {
          gte: driverDay.startedAt,
          lte: driverDay.endedAt || new Date()
        }
      },
      select: {
        id: true,
        cashAmountCents: true,
        taskCompletedAt: true,
        vehiclePlate: true,
        service: {
          select: { name: true }
        }
      },
      orderBy: { taskCompletedAt: 'desc' }
    });

    return NextResponse.json({
      driverDay: {
        id: driverDay.id,
        date: driverDay.date.toISOString(),
        status: driverDay.status,
        startedAt: driverDay.startedAt.toISOString(),
        endedAt: driverDay.endedAt?.toISOString(),
        tasksCompleted,
        tasksInProgress,
        cashCollectedCents: driverDay.cashCollectedCents,
        cashSettledCents: driverDay.cashSettledCents,
        startNotes: driverDay.startNotes,
        endNotes: driverDay.endNotes
      },
      unsettledCollections: unsettledCollections.map(collection => ({
        id: collection.id,
        amountCents: collection.cashAmountCents || 0,
        completedAt: collection.taskCompletedAt?.toISOString(),
        vehiclePlate: collection.vehiclePlate,
        serviceName: collection.service.name
      }))
    });
  } catch (error) {
    console.error("Error fetching driver day:", error);
    return NextResponse.json(
      { error: "Failed to fetch driver day" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') || '';
  const isMobile = userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone');
  const clientType = isMobile ? 'MOBILE' : 'WEB';

  console.log(`[Driver Day API] ===== ${clientType} POST REQUEST =====`);
  console.log(`[Driver Day API] ${clientType} POST request received: ${request.url}`);
  console.log(`[Driver Day API] ${clientType} User-Agent: ${userAgent}`);

  try {
    const body = await request.json();
    console.log(`[Driver Day API] ${clientType} Request body:`, body);
    console.log(`[Driver Day API] ${clientType} Action: ${body.action}`);
    console.log(`[Driver Day API] ${clientType} Notes: ${body.notes}`);

    // Verify driver authentication
    const session = await getMobileUserFromRequest(request);
    console.log(`[Driver Day API] ${clientType} Session:`, { sub: session?.sub, role: session?.role });

    if (!session || session.role !== "DRIVER") {
      console.log(`[Driver Day API] ${clientType} Authentication failed`);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const driverId = session.sub;
    console.log(`[Driver Day API] ${clientType} Authenticated driver: ${driverId}`);

    const { action, notes } = body;

    if (action === "start") {
      // Check if driver already has a shift today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existingDay = await prisma.driverDay.findUnique({
        where: {
          driverId_date: {
            driverId: driverId,
            date: today
          }
        }
      });

      if (existingDay && existingDay.status === "CLOSED") {
        console.log(`[Driver Day API] ${clientType} Driver ${driverId} attempting to start day after previous day was ended`);
        console.log(`[Driver Day API] ${clientType} Previous day ended at: ${existingDay.endedAt}`);

        // Instead of blocking, return information about the previous day
        // Let the frontend decide how to handle this
        return NextResponse.json(
          {
            warning: "Previous day was already ended today",
            previousDay: {
              id: existingDay.id,
              status: existingDay.status,
              endedAt: existingDay.endedAt?.toISOString(),
              date: existingDay.date.toISOString()
            },
            canStartNewDay: false,
            nextAvailableDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            message: "Contact administrator to reset the day if you need to make changes."
          },
          { status: 200 } // Return 200 so frontend can handle as warning, not error
        );
      }

      if (existingDay) {
        return NextResponse.json(
          { error: "Shift already started for today" },
          { status: 400 }
        );
      }

      // Get business hours to validate timing
      const businessHours = await prisma.businessHours.findFirst({
        where: { isActive: true }
      });

      if (businessHours) {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

        // Allow starting up to 2 hours before business hours
        const [startHour, startMinute] = businessHours.startTime.split(':').map(Number);
        const startTimeMinutes = startHour * 60 + startMinute;
        const currentMinutes = parseInt(currentTime.split(':')[0]) * 60 + parseInt(currentTime.split(':')[1]);

        if (currentMinutes < startTimeMinutes - 120) {
          return NextResponse.json(
            { error: `Cannot start shift more than 2 hours before business hours (${businessHours.startTime})` },
            { status: 400 }
          );
        }
      }

      // Start new shift
      const newDriverDay = await prisma.driverDay.create({
        data: {
          driverId: driverId,
          date: today,
          status: "OPEN",
          startNotes: notes || null
        }
      });

      return NextResponse.json({
        driverDay: {
          id: newDriverDay.id,
          date: newDriverDay.date.toISOString(),
          status: newDriverDay.status,
          startedAt: newDriverDay.startedAt.toISOString(),
          tasksCompleted: 0,
          tasksInProgress: 0,
          cashCollectedCents: 0,
          cashSettledCents: 0,
          startNotes: newDriverDay.startNotes
        },
        message: "Shift started successfully"
      });

    } else if (action === "end") {
      console.log(`[Driver Day End] ===== ${clientType} DAY END PROCESS =====`);
      console.log(`[Driver Day End] ${clientType} Driver ${driverId} attempting to end day`);
      console.log(`[Driver Day End] ${clientType} Notes provided:`, notes);

      // Find current open shift
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      console.log(`[Driver Day End] ${clientType} Looking for day on ${today.toISOString()}`);
      console.log(`[Driver Day End] ${clientType} Date object:`, today);

      const driverDay = await prisma.driverDay.findUnique({
        where: {
          driverId_date: {
            driverId: driverId,
            date: today
          }
        }
      });

      console.log(`[Driver Day End] ${clientType} Database query result:`, driverDay);
      console.log(`[Driver Day End] ${clientType} Driver day exists: ${!!driverDay}`);
      if (driverDay) {
        console.log(`[Driver Day End] ${clientType} Driver day status: ${driverDay.status}`);
        console.log(`[Driver Day End] ${clientType} Driver day ID: ${driverDay.id}`);
        console.log(`[Driver Day End] ${clientType} Driver day started at: ${driverDay.startedAt}`);
      }

      if (!driverDay) {
        console.log(`[Driver Day End] ❌ ${clientType} No driver day found in database for driver ${driverId} on date ${today.toISOString()}`);
        return NextResponse.json(
          { error: "No driver day found. You need to start your day first." },
          { status: 400 }
        );
      }

      if (driverDay.status !== "OPEN") {
        console.log(`[Driver Day End] ❌ ${clientType} Driver day status is ${driverDay.status}, not OPEN`);
        return NextResponse.json(
          { error: `Cannot end day with status: ${driverDay.status}` },
          { status: 400 }
        );
      }

      console.log(`[Driver Day End] ✅ ${clientType} Found active driver day, proceeding with end process`);

      // Check for incomplete tasks
      const incompleteTasks = await prisma.booking.count({
        where: {
          driverId: driverId,
          taskStatus: { not: "COMPLETED" },
          taskStartedAt: {
            gte: driverDay.startedAt
          }
        }
      });

      console.log(`[Driver Day End] ${clientType} Found ${incompleteTasks} incomplete tasks`);

      // Temporarily allow ending day even with incomplete tasks for testing
      // if (incompleteTasks > 0) {
      //   return NextResponse.json(
      //     { error: `Cannot end shift with ${incompleteTasks} incomplete task(s)` },
      //     { status: 400 }
      //   );
      // }

      // Calculate totals for the shift
      const shiftCollections = await prisma.booking.aggregate({
        where: {
          driverId: driverId,
          cashCollected: true,
          taskCompletedAt: {
            gte: driverDay.startedAt
          }
        },
        _sum: {
          cashAmountCents: true
        }
      });

      console.log(`[Driver Day End] ${clientType} Shift collections:`, shiftCollections._sum);

      // End the shift
      console.log(`[Driver Day End] ${clientType} Attempting to update driver day in database...`);
      const updatedDriverDay = await prisma.driverDay.update({
        where: { id: driverDay.id },
        data: {
          status: "CLOSED",
          endedAt: new Date(),
          cashCollectedCents: shiftCollections._sum.cashAmountCents || 0,
          endNotes: notes || null
        }
      });

      console.log(`[Driver Day End] ✅ ${clientType} Successfully updated driver day:`, updatedDriverDay);

      return NextResponse.json({
        driverDay: {
          id: updatedDriverDay.id,
          date: updatedDriverDay.date.toISOString(),
          status: updatedDriverDay.status,
          startedAt: updatedDriverDay.startedAt.toISOString(),
          endedAt: updatedDriverDay.endedAt?.toISOString(),
          cashCollectedCents: updatedDriverDay.cashCollectedCents,
          cashSettledCents: updatedDriverDay.cashSettledCents,
          endNotes: updatedDriverDay.endNotes
        },
        message: "Shift ended successfully"
      });

    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'start' or 'end'" },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error(`[Driver Day API] ❌ ${clientType} Error in driver day operation:`, error);
    console.error(`[Driver Day API] ${clientType} Error details:`, error);

    // Try to provide more specific error information
    let errorMessage = "Failed to manage driver day";
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
