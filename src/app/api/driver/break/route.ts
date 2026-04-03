import { NextRequest, NextResponse } from "next/server";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { errorResponse, jsonResponse } from "@/lib/api-response";
import { BREAK_REASON_SCHEMA, type BreakReason } from "@/lib/driver-breaks";
import prisma from "@/lib/prisma";
import { publishLiveUpdate } from "@/lib/liveUpdates";

export async function POST(req: Request) {
  try {
    console.log('[Driver Break] Starting break request...');
    
    const session = await getMobileUserFromRequest(req);
    if (!session || session.role !== "DRIVER") {
      console.log('[Driver Break] Unauthorized - session:', session, 'role:', session?.role);
      return errorResponse("Unauthorized", 401);
    }

    const driverId = session.sub;
    console.log('[Driver Break] Driver ID:', driverId);
    
    const body = await req.json().catch((error) => {
      console.log('[Driver Break] Failed to parse JSON:', error);
      return null;
    });
    
    if (!body) {
      return errorResponse("Invalid request body", 400);
    }

    const { reason, notes } = body;
    
    if (!reason || !Object.keys(BREAK_REASON_SCHEMA).includes(reason)) {
      return errorResponse("Invalid break reason", 400);
    }

    console.log('[Driver Break] Break data:', { reason, notes });

    // Check if driver is currently on a break
    const existingBreak = await prisma.driverBreak.findFirst({
      where: {
        driverId,
        endedAt: null,
      },
    });

    if (existingBreak) {
      return errorResponse("Driver is already on a break", 400);
    }

    // Check if driver has an active day
    const activeDay = await prisma.driverDay.findFirst({
      where: {
        driverId,
        status: "OPEN",
      },
    });

    if (!activeDay) {
      return errorResponse("No active driver day found", 400);
    }

    // Check for existing breaks today and total break time
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayBreaks = await prisma.driverBreak.findMany({
      where: {
        driverId,
        startedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      orderBy: { startedAt: 'asc' },
    });

    // Calculate total break time for today (in minutes)
    const totalBreakTime = todayBreaks.reduce((total: number, break_: any) => {
      if (break_.endedAt) {
        const duration = break_.endedAt.getTime() - break_.startedAt.getTime();
        return total + (duration / (1000 * 60));
      }
      return total;
    }, 0);

    console.log('[Driver Break] Today break statistics:', {
      totalBreaks: todayBreaks.length,
      totalBreakTime: Math.round(totalBreakTime),
      maxAllowedTime: 30
    });

    // Check if total break time exceeds 30 minutes
    if (totalBreakTime >= 30) {
      // Create a break approval request instead of starting break
      const approvalRequest = await prisma.driverBreakApprovalRequest.create({
        data: {
          id: `approval-${driverId}-${Date.now()}`,
          driverId,
          driverDayId: activeDay.id,
          reason: reason as BreakReason,
          reasonDisplay: BREAK_REASON_SCHEMA[reason as BreakReason],
          notes: notes || null,
          requestedDuration: null, // For open-ended breaks
          totalBreakTimeToday: Math.round(totalBreakTime),
          status: 'PENDING',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      console.log('[Driver Break] Approval request created:', approvalRequest.id);

    // Send live update to admin dashboard about new approval request
    publishLiveUpdate({
      type: 'driver.break.approval_requested',
      driverId,
      approvalRequestId: approvalRequest.id,
      reason: approvalRequest.reason,
      reasonDisplay: approvalRequest.reasonDisplay,
      totalBreakTimeToday: approvalRequest.totalBreakTimeToday,
      maxAllowedTime: 30,
      status: 'PENDING',
    }, undefined); // Broadcast to all admin clients

    return NextResponse.json({
      success: false,
      requiresApproval: true,
      message: `You have already taken ${Math.round(totalBreakTime)} minutes of breaks today (30-minute limit exceeded). Your request has been sent to admin for approval.`,
      approvalRequest: {
        id: approvalRequest.id,
        totalBreakTimeToday: Math.round(totalBreakTime),
        maxAllowedTime: 30,
        status: 'PENDING',
      },
    });
    }

    // Create break record
    const driverBreak = await prisma.driverBreak.create({
      data: {
        id: `break-${driverId}-${Date.now()}`,
        driverId,
        driverDayId: activeDay.id,
        reason: reason as BreakReason,
        reasonDisplay: BREAK_REASON_SCHEMA[reason as BreakReason],
        notes: notes || null,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log('[Driver Break] Break started successfully:', driverBreak.id);

    // Send live update to admin dashboard about new break
    publishLiveUpdate({
      type: 'driver.break.started',
      driverId,
      breakId: driverBreak.id,
      reason: driverBreak.reason,
      reasonDisplay: driverBreak.reasonDisplay,
      startedAt: driverBreak.startedAt,
    }, undefined); // Broadcast to all admin clients

    return jsonResponse({
      success: true,
      break: {
        id: driverBreak.id,
        reason: driverBreak.reason,
        reasonDisplay: driverBreak.reasonDisplay,
        notes: driverBreak.notes,
        startedAt: driverBreak.startedAt,
      },
    });

  } catch (error: any) {
    console.error('[Driver Break] Error:', error);
    return errorResponse("Internal server error", 500);
  }
}

export async function PUT(req: Request) {
  try {
    console.log('[Driver Break] Ending break request...');
    
    const session = await getMobileUserFromRequest(req);
    if (!session || session.role !== "DRIVER") {
      return errorResponse("Unauthorized", 401);
    }

    const driverId = session.sub;
    
    // Find active break
    const activeBreak = await prisma.driverBreak.findFirst({
      where: {
        driverId,
        endedAt: null,
      },
    });

    if (!activeBreak) {
      return errorResponse("No active break found", 404);
    }

    // End the break
    const endedBreak = await prisma.driverBreak.update({
      where: { id: activeBreak.id },
      data: {
        endedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const breakDuration = (endedBreak.endedAt || new Date()).getTime() - endedBreak.startedAt.getTime();
    const breakMinutes = Math.round(breakDuration / (1000 * 60));

    console.log('[Driver Break] Break ended successfully:', {
      breakId: endedBreak.id,
      duration: breakMinutes,
    });

    return jsonResponse({
      success: true,
      break: {
        id: endedBreak.id,
        reason: endedBreak.reason,
        reasonDisplay: endedBreak.reasonDisplay,
        startedAt: endedBreak.startedAt,
        endedAt: endedBreak.endedAt,
        durationMinutes: breakMinutes,
      },
    });

  } catch (error: any) {
    console.error('[Driver Break] Error ending break:', error);
    return errorResponse("Internal server error", 500);
  }
}

export async function GET(req: Request) {
  try {
    console.log('[Driver Break] Getting break status...');
    
    const session = await getMobileUserFromRequest(req);
    if (!session || session.role !== "DRIVER") {
      return errorResponse("Unauthorized", 401);
    }

    const driverId = session.sub;
    
    // Find active break
    const activeBreak = await prisma.driverBreak.findFirst({
      where: {
        driverId,
        endedAt: null,
      },
      select: {
        id: true,
        reason: true,
        reasonDisplay: true,
        notes: true,
        startedAt: true,
      },
    });

    // Get today's breaks
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayBreaks = await prisma.driverBreak.findMany({
      where: {
        driverId,
        startedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      select: {
        id: true,
        reason: true,
        reasonDisplay: true,
        startedAt: true,
        endedAt: true,
        notes: true,
      },
      orderBy: { startedAt: 'desc' },
    });

    const totalBreakTime = todayBreaks.reduce((total: number, break_: any) => {
      if (break_.endedAt) {
        const duration = break_.endedAt.getTime() - break_.startedAt.getTime();
        return total + duration;
      }
      return total;
    }, 0);

    const totalBreakMinutes = Math.round(totalBreakTime / (1000 * 60));

    console.log('[Driver Break] Break status retrieved:', {
      hasActiveBreak: !!activeBreak,
      totalBreaksToday: todayBreaks.length,
      totalBreakMinutes,
    });

    return jsonResponse({
      activeBreak,
      todayBreaks,
      totalBreakMinutes,
      onBreak: !!activeBreak,
    });

  } catch (error: any) {
    console.error('[Driver Break] Error getting break status:', error);
    return errorResponse("Internal server error", 500);
  }
}
