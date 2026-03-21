import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET: Fetch event statistics for dashboard
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const since = searchParams.get("since");
  const sinceDate = since ? new Date(since) : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: last 24 hours

  try {
    const where = { createdAt: { gte: sinceDate } };

    const [
      total,
      unprocessed,
      byCategory,
      bySeverity,
      byEventType,
      recentCritical,
      hourlyTrend,
    ] = await Promise.all([
      // Total events
      prisma.system_events.count({ where }),
      
      // Unprocessed events
      prisma.system_events.count({ where: { ...where, processed: false } }),
      
      // By category
      prisma.system_events.groupBy({
        by: ["category"],
        where,
        _count: true,
      }),
      
      // By severity
      prisma.system_events.groupBy({
        by: ["severity"],
        where,
        _count: true,
      }),
      
      // Top event types
      prisma.system_events.groupBy({
        by: ["eventType"],
        where,
        _count: true,
        orderBy: { _count: { eventType: "desc" } },
        take: 10,
      }),
      
      // Recent critical/error events
      prisma.system_events.findMany({
        where: {
          ...where,
          severity: { in: ["CRITICAL", "ERROR"] },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      
      // Hourly trend (last 24 hours)
      prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('hour', "createdAt") as hour,
          COUNT(*)::int as count
        FROM system_events
        WHERE "createdAt" >= ${sinceDate}
        GROUP BY DATE_TRUNC('hour', "createdAt")
        ORDER BY hour ASC
      ` as Promise<Array<{ hour: Date; count: number }>>,
    ]);

    // Format statistics
    const categoryStats = byCategory.reduce((acc, item) => {
      acc[item.category] = item._count;
      return acc;
    }, {} as Record<string, number>);

    const severityStats = bySeverity.reduce((acc, item) => {
      acc[item.severity] = item._count;
      return acc;
    }, {} as Record<string, number>);

    const topEventTypes = byEventType.map((item) => ({
      type: item.eventType,
      count: item._count,
    }));

    return NextResponse.json({
      summary: {
        total,
        unprocessed,
        critical: severityStats.CRITICAL ?? 0,
        errors: severityStats.ERROR ?? 0,
        warnings: severityStats.WARNING ?? 0,
        info: severityStats.INFO ?? 0,
      },
      byCategory: categoryStats,
      bySeverity: severityStats,
      topEventTypes,
      recentCritical,
      hourlyTrend: hourlyTrend.map((item) => ({
        hour: item.hour.toISOString(),
        count: item.count,
      })),
      period: {
        since: sinceDate.toISOString(),
        until: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[notification-center/statistics] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}
