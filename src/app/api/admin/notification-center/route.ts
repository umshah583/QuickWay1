import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET: Fetch system events for notification center
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);
  const category = searchParams.get("category");
  const severity = searchParams.get("severity");
  const eventType = searchParams.get("eventType");
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  const search = searchParams.get("search");
  const since = searchParams.get("since");
  const processed = searchParams.get("processed");

  try {
    // Build where clause
    const where: Record<string, unknown> = {};

    if (category) {
      where.category = category;
    }

    if (severity) {
      where.severity = severity;
    }

    if (eventType) {
      where.eventType = eventType;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    if (since) {
      where.createdAt = { gte: new Date(since) };
    }

    if (processed !== null && processed !== undefined) {
      where.processed = processed === "true";
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { actorName: { contains: search, mode: "insensitive" } },
      ];
    }

    const [events, total] = await Promise.all([
      prisma.system_events.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.system_events.count({ where }),
    ]);

    return NextResponse.json({
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[notification-center] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}

// POST: Mark events as processed or create manual event
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, eventIds, event } = body;

    if (action === "markProcessed" && eventIds?.length > 0) {
      await prisma.system_events.updateMany({
        where: { id: { in: eventIds } },
        data: { processed: true, processedAt: new Date() },
      });
      return NextResponse.json({ success: true, processed: eventIds.length });
    }

    if (action === "create" && event) {
      const newEvent = await prisma.system_events.create({
        data: {
          eventType: event.eventType ?? "SYSTEM_WARNING",
          category: event.category ?? "SYSTEM",
          severity: event.severity ?? "INFO",
          title: event.title,
          description: event.description,
          entityType: event.entityType,
          entityId: event.entityId,
          actorId: session.user.id,
          actorType: "ADMIN",
          actorName: session.user.name,
          targetRoles: event.targetRoles,
          targetUserIds: event.targetUserIds,
          metadata: event.metadata,
        } as any,
      });
      return NextResponse.json({ success: true, event: newEvent });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[notification-center] POST Error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
