import { NextRequest, NextResponse } from "next/server";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import prisma from "@/lib/prisma";
import { getDriverDutySettings, type DriverDutySettings } from "@/lib/admin-settings";

type DutyWindow = { start: Date; end: Date };

function parseTimeForDate(time: string, baseDate: Date): Date {
  const [hours, minutes] = time.split(":").map((val) => parseInt(val, 10));
  const date = new Date(baseDate);
  date.setHours(hours, minutes || 0, 0, 0);
  return date;
}

function normalizeWindow(start: Date, end: Date): DutyWindow {
  const windowEnd = new Date(end);
  if (windowEnd <= start) {
    windowEnd.setDate(windowEnd.getDate() + 1);
  }
  return { start, end: windowEnd };
}

function buildDutyWindows(dutySettings: DriverDutySettings | null, referenceDate?: Date): DutyWindow[] {
  if (!dutySettings) return [];
  const baseDate = referenceDate ? new Date(referenceDate) : new Date();
  const windows: DutyWindow[] = [];

  if (dutySettings.shifts && dutySettings.shifts.length > 0) {
    dutySettings.shifts.forEach((shift) => {
      if (shift.startTime && shift.endTime) {
        const start = parseTimeForDate(shift.startTime, baseDate);
        const end = parseTimeForDate(shift.endTime, baseDate);
        windows.push(normalizeWindow(start, end));
      }
    });
  } else if (dutySettings.startTime && dutySettings.endTime) {
    const start = parseTimeForDate(dutySettings.startTime, baseDate);
    const end = parseTimeForDate(dutySettings.endTime, baseDate);
    windows.push(normalizeWindow(start, end));
  }

  return windows.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function isWithinDutyWindow(now: Date, windows: DutyWindow[]): boolean {
  if (windows.length === 0) {
    return true;
  }
  return windows.some((window) => now >= window.start && now <= window.end);
}

function getLastWindowEnd(windows: DutyWindow[]): Date | null {
  if (windows.length === 0) return null;
  return windows.reduce(
    (latest, window) => (window.end > latest ? window.end : latest),
    windows[0].end,
  );
}

function formatWindow(window: DutyWindow) {
  return {
    start: window.start.toISOString(),
    end: window.end.toISOString(),
  };
}

async function finalizeDriverDay(driverDayId: string, driverId: string, reason?: string) {
  const driverDay = await prisma.driverDay.findUnique({ where: { id: driverDayId } });
  if (!driverDay || driverDay.status !== "OPEN") {
    return driverDay;
  }

  console.log(`[Driver Day AutoClose] Finalizing driver day ${driverDayId} for driver ${driverId}`);

  const shiftCollections = await prisma.booking.aggregate({
    where: {
      driverId: driverId,
      cashCollected: true,
      taskCompletedAt: {
        gte: driverDay.startedAt,
      },
    },
    _sum: {
      cashAmountCents: true,
    },
  });

  const updatedDriverDay = await prisma.driverDay.update({
    where: { id: driverDay.id },
    data: {
      status: "CLOSED",
      endedAt: new Date(),
      cashCollectedCents: shiftCollections._sum.cashAmountCents || 0,
      endNotes: reason ?? driverDay.endNotes ?? null,
    },
  });

  console.log(`[Driver Day AutoClose] Driver day ${driverDayId} closed automatically`);

  return updatedDriverDay;
}

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

    const dutySettings = await getDriverDutySettings(driverId, targetDate);
    const dutyWindows = buildDutyWindows(dutySettings, targetDate);
    const dutyWindowPayload = dutyWindows.map(formatWindow);
    console.log("[Driver Day API] Duty schedule snapshot", {
      driverId,
      targetDate: targetDate.toISOString().slice(0, 10),
      startTime: dutySettings?.startTime,
      endTime: dutySettings?.endTime,
      shifts: dutySettings?.shifts,
      weeklySchedule: dutySettings?.weeklySchedule,
      dutyWindows: dutyWindowPayload,
    });
    const now = new Date();
    const withinDutyWindow = isWithinDutyWindow(now, dutyWindows);
    const nextDutyWindow = dutyWindows.find((window) => now < window.start) ?? null;

    // CRITICAL: Check for any unclosed days from previous dates
    let unclosedDay = await prisma.driverDay.findFirst({
      where: {
        driverId: driverId,
        status: "OPEN",
        date: { lt: targetDate } // Only previous dates
      },
      orderBy: { date: 'desc' }
    });

    if (unclosedDay) {
      const unclosedDayDate = new Date(unclosedDay.date);
      const dutySettingsForUnclosed = await getDriverDutySettings(driverId, unclosedDayDate);
      const dutyWindowsForUnclosed = buildDutyWindows(dutySettingsForUnclosed, unclosedDayDate);
      const lastWindowEndUnclosed = getLastWindowEnd(dutyWindowsForUnclosed);

      if (lastWindowEndUnclosed && now > lastWindowEndUnclosed) {
        console.log(`[Driver Day API] Auto-ending previous open day ${unclosedDay.id} for driver ${driverId}`);
        const closedDay = await finalizeDriverDay(unclosedDay.id, driverId, "Auto-ended after duty schedule");
        if (closedDay?.status === "CLOSED") {
          unclosedDay = null;
        }
      }
    }

    // Find the driver's current day
    let driverDay = await prisma.driverDay.findUnique({
      where: {
        driverId_date: {
          driverId: driverId,
          date: targetDate
        }
      }
    });

    if (driverDay && driverDay.status === "OPEN") {
      const dutySettingsForDay = await getDriverDutySettings(driverId, new Date(driverDay.date));
      const dutyWindowsForDay = buildDutyWindows(dutySettingsForDay, new Date(driverDay.date));
      const lastWindowEnd = getLastWindowEnd(dutyWindowsForDay);
      if (lastWindowEnd && now > lastWindowEnd) {
        console.log(`[Driver Day API] Auto-ending driver day ${driverDay.id} for driver ${driverId} (after duty window)`);
        driverDay = await finalizeDriverDay(driverDay.id, driverId, "Auto-ended after duty schedule");
      }
    }

    if (!driverDay) {
      // If there's an unclosed day from a previous date, return it so the app can prompt to close it
      if (unclosedDay) {
        return NextResponse.json({
          driverDay: null,
          unclosedDay: {
            id: unclosedDay.id,
            date: unclosedDay.date.toISOString(),
            status: unclosedDay.status,
            startedAt: unclosedDay.startedAt.toISOString(),
          },
          requiresAction: "END_PREVIOUS_DAY",
          message: "You have an unclosed day from a previous date. Please end it before starting a new day.",
          dutyWindows: dutyWindowPayload,
          isWithinDutyWindow: withinDutyWindow,
          nextDutyWindowStart: nextDutyWindow?.start.toISOString() ?? null,
          dutyEnforcementMessage: withinDutyWindow ? undefined : "You are currently outside of your scheduled duty hours."
        });
      }
      return NextResponse.json({
        driverDay: null,
        message: "No shift started for this date",
        dutyWindows: dutyWindowPayload,
        isWithinDutyWindow: withinDutyWindow,
        nextDutyWindowStart: nextDutyWindow?.start.toISOString() ?? null,
        dutyEnforcementMessage: withinDutyWindow ? undefined : "You are currently outside of your scheduled duty hours.",
        requiresAction: withinDutyWindow ? undefined : "WAIT_FOR_DUTY_WINDOW"
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

    // Get all pending tasks (assigned but not completed, regardless of payment method)
    const pendingTasks = await prisma.booking.count({
      where: {
        driverId: driverId,
        taskStatus: { not: "COMPLETED" }
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
        pendingTasks,
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
      })),
      dutyWindows: dutyWindowPayload,
      isWithinDutyWindow: withinDutyWindow,
      nextDutyWindowStart: nextDutyWindow?.start.toISOString() ?? null,
      dutyEnforcementMessage: withinDutyWindow ? undefined : "You are currently outside of your scheduled duty hours.",
      requiresAction: withinDutyWindow ? undefined : "WAIT_FOR_DUTY_WINDOW"
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
      // CRITICAL: Check if driver has ANY open day from previous dates that hasn't been ended
      // This prevents drivers from starting a new day without ending the previous one
      let openDayFromPreviousDate = await prisma.driverDay.findFirst({
        where: {
          driverId: driverId,
          status: "OPEN",
        },
        orderBy: { date: 'desc' }
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (openDayFromPreviousDate) {
        const openDayDate = new Date(openDayFromPreviousDate.date);
        openDayDate.setHours(0, 0, 0, 0);

        if (openDayDate.getTime() < today.getTime()) {
          const dutySettingsForOpenDay = await getDriverDutySettings(driverId, openDayDate);
          const dutyWindowsForOpenDay = buildDutyWindows(dutySettingsForOpenDay, openDayDate);
          const lastWindowEndOpenDay = getLastWindowEnd(dutyWindowsForOpenDay);

          if (lastWindowEndOpenDay && new Date() > lastWindowEndOpenDay) {
            console.log(`[Driver Day API] ${clientType} Auto-ending previous day ${openDayFromPreviousDate.id} before start.`);
            const closedDay = await finalizeDriverDay(openDayFromPreviousDate.id, driverId, "Auto-ended before starting new day");
            if (closedDay?.status === "CLOSED") {
              openDayFromPreviousDate = await prisma.driverDay.findFirst({
                where: {
                  driverId: driverId,
                  status: "OPEN",
                },
                orderBy: { date: 'desc' }
              });
            }
          }
        }
        
        // If there's an open day from a PREVIOUS date (not today), block starting a new day
        if (openDayFromPreviousDate && openDayDate.getTime() < today.getTime()) {
          console.log(`[Driver Day API] ${clientType} BLOCKING: Driver ${driverId} has unclosed day from ${openDayFromPreviousDate.date.toISOString()}`);
          console.log(`[Driver Day API] ${clientType} Open day ID: ${openDayFromPreviousDate.id}, started at: ${openDayFromPreviousDate.startedAt}`);
          
          return NextResponse.json(
            {
              error: "You have an unclosed day from a previous date. Please end that day first before starting a new one.",
              unclosedDay: {
                id: openDayFromPreviousDate.id,
                date: openDayFromPreviousDate.date.toISOString(),
                status: openDayFromPreviousDate.status,
                startedAt: openDayFromPreviousDate.startedAt.toISOString(),
              },
              requiresAction: "END_PREVIOUS_DAY",
              message: "You must end your previous day before starting a new one. Go to Day Management and end your previous shift."
            },
            { status: 400 }
          );
        }
        
        // If there's an open day for TODAY, it's already started
        if (openDayDate.getTime() === today.getTime()) {
          return NextResponse.json(
            { error: "Shift already started for today" },
            { status: 400 }
          );
        }
      }

      // Check if driver already has a closed shift today (already ended)
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

      // Enforce duty schedule from admin settings
      const dutySettings = await getDriverDutySettings(driverId);
      const dutyWindows = buildDutyWindows(dutySettings);
      const dutyWindowPayload = dutyWindows.map(formatWindow);
      const now = new Date();
      const withinDutyWindow = isWithinDutyWindow(now, dutyWindows);
      const nextDutyWindow = dutyWindows.find((window) => now < window.start) ?? null;

      if (!withinDutyWindow) {
        console.log(`[Driver Day API] ${clientType} Driver ${driverId} attempted to start outside duty window`);
        return NextResponse.json(
          {
            error: "You are outside of your scheduled duty hours.",
            requiresAction: "WAIT_FOR_DUTY_WINDOW",
            dutyWindows: dutyWindowPayload,
            nextDutyWindowStart: nextDutyWindow?.start.toISOString() ?? null,
            dutyEnforcementMessage: "Please wait until your next scheduled duty window to start your day."
          },
          { status: 400 }
        );
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

      // Find ANY open shift for this driver (not just today)
      // This allows ending unclosed days from previous dates
      console.log(`[Driver Day End] ${clientType} Looking for any OPEN day for driver ${driverId}`);

      const driverDay = await prisma.driverDay.findFirst({
        where: {
          driverId: driverId,
          status: "OPEN"
        },
        orderBy: { date: 'desc' } // Get the most recent open day
      });

      console.log(`[Driver Day End] ${clientType} Database query result:`, driverDay);
      console.log(`[Driver Day End] ${clientType} Driver day exists: ${!!driverDay}`);
      if (driverDay) {
        console.log(`[Driver Day End] ${clientType} Driver day status: ${driverDay.status}`);
        console.log(`[Driver Day End] ${clientType} Driver day ID: ${driverDay.id}`);
        console.log(`[Driver Day End] ${clientType} Driver day date: ${driverDay.date}`);
        console.log(`[Driver Day End] ${clientType} Driver day started at: ${driverDay.startedAt}`);
      }

      if (!driverDay) {
        console.log(`[Driver Day End] ❌ ${clientType} No open driver day found for driver ${driverId}`);
        return NextResponse.json(
          { error: "No open day found. You need to start your day first." },
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
