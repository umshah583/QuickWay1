import prisma from "@/lib/prisma";
import {
  SystemEventType,
  EventCategory,
  EventSeverity,
  ActorType,
  UserRole,
  TrackingEventType,
} from "@prisma/client";

// Event emitter for real-time updates
type EventListener = (event: SystemEventPayload) => void;
const eventListeners: Map<string, Set<EventListener>> = new Map();

export interface SystemEventPayload {
  id: string;
  eventType: SystemEventType;
  category: EventCategory;
  severity: EventSeverity;
  title: string;
  description: string;
  entityType?: string | null;
  entityId?: string | null;
  actorId?: string | null;
  actorType?: ActorType | null;
  actorName?: string | null;
  targetUserIds: string[];
  targetRoles: UserRole[];
  latitude?: number | null;
  longitude?: number | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

export interface CreateEventInput {
  eventType: SystemEventType;
  category: EventCategory;
  severity?: EventSeverity;
  title: string;
  description: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  actorType?: ActorType;
  actorName?: string;
  targetUserIds?: string[];
  targetRoles?: UserRole[];
  latitude?: number;
  longitude?: number;
  metadata?: Record<string, unknown>;
}

export interface LiveTrackingInput {
  bookingId: string;
  driverId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  batteryLevel?: number;
  eventType?: TrackingEventType;
}

// Subscribe to real-time events
export function subscribeToEvents(channel: string, listener: EventListener): () => void {
  if (!eventListeners.has(channel)) {
    eventListeners.set(channel, new Set());
  }
  eventListeners.get(channel)!.add(listener);
  
  // Return unsubscribe function
  return () => {
    eventListeners.get(channel)?.delete(listener);
  };
}

// Broadcast event to all subscribers
function broadcastEvent(event: SystemEventPayload) {
  // Broadcast to global channel
  eventListeners.get("global")?.forEach((listener) => listener(event));
  
  // Broadcast to category-specific channel
  eventListeners.get(`category:${event.category}`)?.forEach((listener) => listener(event));
  
  // Broadcast to entity-specific channel
  if (event.entityType && event.entityId) {
    eventListeners.get(`entity:${event.entityType}:${event.entityId}`)?.forEach((listener) => listener(event));
  }
  
  // Broadcast to user-specific channels
  event.targetUserIds.forEach((userId) => {
    eventListeners.get(`user:${userId}`)?.forEach((listener) => listener(event));
  });
  
  // Broadcast to role-specific channels
  event.targetRoles.forEach((role) => {
    eventListeners.get(`role:${role}`)?.forEach((listener) => listener(event));
  });
}

// Create and broadcast a system event
export async function createSystemEvent(input: CreateEventInput): Promise<SystemEventPayload> {
  const event = await prisma.system_events.create({
    data: {
      eventType: input.eventType,
      category: input.category,
      severity: input.severity ?? EventSeverity.INFO,
      title: input.title,
      description: input.description,
      entityType: input.entityType,
      entityId: input.entityId,
      actorId: input.actorId,
      actorType: input.actorType,
      actorName: input.actorName,
      targetUserIds: input.targetUserIds ?? [],
      targetRoles: input.targetRoles ?? [],
      latitude: input.latitude,
      longitude: input.longitude,
      metadata: input.metadata ?? undefined,
    } as any,
  });

  const payload: SystemEventPayload = {
    id: event.id,
    eventType: event.eventType,
    category: event.category,
    severity: event.severity,
    title: event.title,
    description: event.description,
    entityType: event.entityType,
    entityId: event.entityId,
    actorId: event.actorId,
    actorType: event.actorType,
    actorName: event.actorName,
    targetUserIds: event.targetUserIds,
    targetRoles: event.targetRoles,
    latitude: event.latitude,
    longitude: event.longitude,
    metadata: event.metadata as Record<string, unknown> | null,
    createdAt: event.createdAt,
  };

  // Broadcast to all listeners
  broadcastEvent(payload);

  return payload;
}

// Create live tracking event
export async function createLiveTrackingEvent(input: LiveTrackingInput) {
  const trackingEvent = await prisma.live_tracking_events.create({
    data: {
      bookingId: input.bookingId,
      driverId: input.driverId,
      latitude: input.latitude,
      longitude: input.longitude,
      speed: input.speed,
      heading: input.heading,
      accuracy: input.accuracy,
      batteryLevel: input.batteryLevel,
      eventType: input.eventType ?? TrackingEventType.LOCATION_UPDATE,
    } as any,
  });

  // Also create a system event for significant tracking updates
  if (input.eventType && input.eventType !== TrackingEventType.LOCATION_UPDATE) {
    await createSystemEvent({
      eventType: SystemEventType.DRIVER_LOCATION_UPDATE,
      category: EventCategory.TRACKING,
      title: `Driver ${input.eventType.replace(/_/g, " ").toLowerCase()}`,
      description: `Driver location update for booking ${input.bookingId}`,
      entityType: "booking",
      entityId: input.bookingId,
      actorId: input.driverId,
      actorType: ActorType.DRIVER,
      latitude: input.latitude,
      longitude: input.longitude,
      metadata: {
        speed: input.speed,
        heading: input.heading,
        accuracy: input.accuracy,
        batteryLevel: input.batteryLevel,
      },
    });
  }

  return trackingEvent;
}

// Helper functions for common events

export async function emitBookingCreated(
  bookingId: string,
  customerId: string,
  customerName: string,
  serviceName: string,
  metadata?: Record<string, unknown>
) {
  return createSystemEvent({
    eventType: SystemEventType.BOOKING_CREATED,
    category: EventCategory.BOOKING,
    title: "New Booking Created",
    description: `${customerName} booked ${serviceName}`,
    entityType: "booking",
    entityId: bookingId,
    actorId: customerId,
    actorType: ActorType.CUSTOMER,
    actorName: customerName,
    targetRoles: [UserRole.ADMIN],
    metadata,
  });
}

export async function emitBookingAssigned(
  bookingId: string,
  driverId: string,
  driverName: string,
  customerId: string,
  serviceName: string
) {
  return createSystemEvent({
    eventType: SystemEventType.BOOKING_ASSIGNED,
    category: EventCategory.BOOKING,
    title: "Driver Assigned",
    description: `${driverName} assigned to ${serviceName}`,
    entityType: "booking",
    entityId: bookingId,
    actorType: ActorType.SYSTEM,
    targetUserIds: [customerId, driverId],
    targetRoles: [UserRole.ADMIN],
    metadata: { driverId, driverName },
  });
}

export async function emitBookingStarted(
  bookingId: string,
  driverId: string,
  driverName: string,
  customerId: string,
  latitude?: number,
  longitude?: number
) {
  return createSystemEvent({
    eventType: SystemEventType.BOOKING_STARTED,
    category: EventCategory.BOOKING,
    title: "Service Started",
    description: `${driverName} has started the service`,
    entityType: "booking",
    entityId: bookingId,
    actorId: driverId,
    actorType: ActorType.DRIVER,
    actorName: driverName,
    targetUserIds: [customerId],
    targetRoles: [UserRole.ADMIN],
    latitude,
    longitude,
  });
}

export async function emitBookingCompleted(
  bookingId: string,
  driverId: string,
  driverName: string,
  customerId: string,
  serviceName: string,
  amountCents?: number
) {
  return createSystemEvent({
    eventType: SystemEventType.BOOKING_COMPLETED,
    category: EventCategory.BOOKING,
    title: "Service Completed",
    description: `${driverName} completed ${serviceName}`,
    entityType: "booking",
    entityId: bookingId,
    actorId: driverId,
    actorType: ActorType.DRIVER,
    actorName: driverName,
    targetUserIds: [customerId],
    targetRoles: [UserRole.ADMIN],
    metadata: { amountCents },
  });
}

export async function emitDriverLocationUpdate(
  bookingId: string,
  driverId: string,
  driverName: string,
  customerId: string,
  latitude: number,
  longitude: number,
  status: "en_route" | "arrived" | "in_progress"
) {
  const eventType = status === "en_route" 
    ? SystemEventType.DRIVER_EN_ROUTE 
    : status === "arrived" 
      ? SystemEventType.DRIVER_ARRIVED 
      : SystemEventType.DRIVER_LOCATION_UPDATE;
  
  const title = status === "en_route" 
    ? "Driver En Route" 
    : status === "arrived" 
      ? "Driver Arrived" 
      : "Driver Location Updated";

  return createSystemEvent({
    eventType,
    category: EventCategory.TRACKING,
    title,
    description: `${driverName} is ${status.replace(/_/g, " ")}`,
    entityType: "booking",
    entityId: bookingId,
    actorId: driverId,
    actorType: ActorType.DRIVER,
    actorName: driverName,
    targetUserIds: [customerId],
    latitude,
    longitude,
  });
}

export async function emitPaymentReceived(
  bookingId: string,
  customerId: string,
  customerName: string,
  amountCents: number,
  paymentMethod: string
) {
  return createSystemEvent({
    eventType: SystemEventType.BOOKING_PAYMENT_RECEIVED,
    category: EventCategory.PAYMENT,
    title: "Payment Received",
    description: `Payment of AED ${(amountCents / 100).toFixed(2)} received via ${paymentMethod}`,
    entityType: "booking",
    entityId: bookingId,
    actorId: customerId,
    actorType: ActorType.CUSTOMER,
    actorName: customerName,
    targetRoles: [UserRole.ADMIN],
    metadata: { amountCents, paymentMethod },
  });
}

export async function emitCashCollected(
  bookingId: string,
  driverId: string,
  driverName: string,
  amountCents: number
) {
  return createSystemEvent({
    eventType: SystemEventType.DRIVER_CASH_COLLECTED,
    category: EventCategory.PAYMENT,
    title: "Cash Collected",
    description: `${driverName} collected AED ${(amountCents / 100).toFixed(2)} cash`,
    entityType: "booking",
    entityId: bookingId,
    actorId: driverId,
    actorType: ActorType.DRIVER,
    actorName: driverName,
    targetRoles: [UserRole.ADMIN],
    metadata: { amountCents },
  });
}

// Get recent events for notification center
export async function getRecentEvents(options: {
  limit?: number;
  category?: EventCategory;
  userId?: string;
  role?: UserRole;
  entityType?: string;
  entityId?: string;
  severity?: EventSeverity;
  since?: Date;
}) {
  const where: Record<string, unknown> = {};

  if (options.category) {
    where.category = options.category;
  }

  if (options.entityType) {
    where.entityType = options.entityType;
  }

  if (options.entityId) {
    where.entityId = options.entityId;
  }

  if (options.severity) {
    where.severity = options.severity;
  }

  if (options.since) {
    where.createdAt = { gte: options.since };
  }

  if (options.userId) {
    where.OR = [
      { targetUserIds: { has: options.userId } },
      { actorId: options.userId },
    ];
  }

  if (options.role) {
    where.targetRoles = { has: options.role };
  }

  return prisma.system_events.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 50,
  });
}

// Get live tracking history for a booking
export async function getLiveTrackingHistory(bookingId: string, since?: Date) {
  return prisma.live_tracking_events.findMany({
    where: {
      bookingId,
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
}

// Mark events as processed
export async function markEventsAsProcessed(eventIds: string[]) {
  return prisma.system_events.updateMany({
    where: { id: { in: eventIds } },
    data: { processed: true, processedAt: new Date() },
  });
}

// Get event statistics
export async function getEventStatistics(since?: Date) {
  const where = since ? { createdAt: { gte: since } } : {};
  
  const [total, byCategory, bySeverity, byType] = await Promise.all([
    prisma.system_events.count({ where }),
    prisma.system_events.groupBy({
      by: ["category"],
      where,
      _count: true,
    }),
    prisma.system_events.groupBy({
      by: ["severity"],
      where,
      _count: true,
    }),
    prisma.system_events.groupBy({
      by: ["eventType"],
      where,
      _count: true,
      orderBy: { _count: { eventType: "desc" } },
      take: 10,
    }),
  ]);

  return {
    total,
    byCategory: byCategory.reduce((acc, item) => {
      acc[item.category] = item._count;
      return acc;
    }, {} as Record<string, number>),
    bySeverity: bySeverity.reduce((acc, item) => {
      acc[item.severity] = item._count;
      return acc;
    }, {} as Record<string, number>),
    topEventTypes: byType.map((item) => ({
      type: item.eventType,
      count: item._count,
    })),
  };
}
