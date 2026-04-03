import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET - Fetch all break approval requests
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'ALL';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    console.log('[Admin Break Approvals] Fetching requests:', { status, page, limit });

    // Build where clause
    const whereClause = status !== 'ALL' ? { status } : {};

    // Get approval requests with driver info
    const [requests, totalCount] = await Promise.all([
      prisma.driverBreakApprovalRequest.findMany({
        where: whereClause,
        include: {
          User: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          },
          DriverDay: {
            select: {
              id: true,
              date: true,
              status: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.driverBreakApprovalRequest.count({ where: whereClause })
    ]);

    // Get today's break statistics for each driver
    const requestsWithStats = await Promise.all(
      requests.map(async (request) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayBreaks = await prisma.driverBreak.findMany({
          where: {
            driverId: request.driverId,
            startedAt: {
              gte: today,
              lt: tomorrow,
            },
          },
        });

        const totalBreakTime = todayBreaks.reduce((total: number, break_: any) => {
          if (break_.endedAt) {
            const duration = break_.endedAt.getTime() - break_.startedAt.getTime();
            return total + (duration / (1000 * 60));
          }
          return total;
        }, 0);

        return {
          ...request,
          todayBreakStats: {
            totalBreaks: todayBreaks.length,
            totalBreakTime: Math.round(totalBreakTime),
            maxAllowedTime: 30,
            remainingTime: Math.max(0, 30 - Math.round(totalBreakTime))
          }
        };
      })
    );

    return NextResponse.json({
      success: true,
      requests: requestsWithStats,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      },
      filters: { status },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Admin Break Approvals GET] Error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Approve or reject a break request
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { requestId, action, rejectionReason } = body;

    if (!requestId || !action || !['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json(
        { error: "Invalid request. requestId and action (APPROVE/REJECT) are required." },
        { status: 400 }
      );
    }

    console.log('[Admin Break Approvals] Processing request:', { requestId, action, adminId: session.user.id });

    // Get the approval request
    const approvalRequest = await prisma.driverBreakApprovalRequest.findUnique({
      where: { id: requestId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });

    if (!approvalRequest) {
      return NextResponse.json(
        { error: "Approval request not found" },
        { status: 404 }
      );
    }

    if (approvalRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Request already ${approvalRequest.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    // Update the approval request
    const updatedRequest = await prisma.driverBreakApprovalRequest.update({
      where: { id: requestId },
      data: {
        status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        approvedBy: session.user.id,
        approvedAt: new Date(),
        rejectionReason: action === 'REJECT' ? rejectionReason : null,
        updatedAt: new Date(),
      },
    });

    // If approved, create the actual break
    if (action === 'APPROVE') {
      await prisma.driverBreak.create({
        data: {
          id: `break-${approvalRequest.driverId}-${Date.now()}`,
          driverId: approvalRequest.driverId,
          driverDayId: approvalRequest.driverDayId,
          reason: approvalRequest.reason,
          reasonDisplay: approvalRequest.reasonDisplay,
          notes: approvalRequest.notes,
          startedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      console.log('[Admin Break Approvals] Break created for approved request:', requestId);
    }

    console.log('[Admin Break Approvals] Request processed:', {
      requestId,
      action,
      driverName: approvalRequest.User.name,
      adminName: session.user.name
    });

    return NextResponse.json({
      success: true,
      message: `Break request ${action === 'APPROVE' ? 'approved' : 'rejected'} successfully`,
      request: updatedRequest,
      driver: approvalRequest.User,
      action,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Admin Break Approvals POST] Error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
