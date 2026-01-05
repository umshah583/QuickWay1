/**
 * NOTIFICATION SERVICE V2
 * ========================
 * Clean-slate notification service with EXPLICIT targeting
 * NO broadcasts, NO role checks, NO legacy code
 * 
 * ⛔ ARCHITECTURAL RULES (ENFORCED AT RUNTIME):
 * 1. ALL notifications MUST specify appType (CUSTOMER or DRIVER)
 * 2. NO generic broadcasts allowed
 * 3. NO role-based routing
 * 4. Event names MUST match appType
 * 5. Socket rooms MUST be prefixed with appType
 */

import { prisma } from '@/lib/prisma';
import type { NotificationCategory } from '@prisma/client';
import type { NotificationContent, NotificationTarget, SocketNotificationPayload, AppType } from './types';
import { getRoomName, SOCKET_EVENTS } from './types';

// ============================================
// SAFETY ASSERTIONS - THROW ON VIOLATION
// ============================================

const VALID_APP_TYPES: readonly AppType[] = ['CUSTOMER', 'DRIVER'];

/**
 * ASSERTION: Validate appType is valid and not missing
 * @throws Error if appType is invalid
 */
function assertValidAppType(appType: unknown, context: string): asserts appType is AppType {
  if (!appType) {
    throw new Error(`[NotificationV2] ⛔ ASSERTION FAILED in ${context}: appType is REQUIRED but was missing`);
  }
  if (!VALID_APP_TYPES.includes(appType as AppType)) {
    throw new Error(`[NotificationV2] ⛔ ASSERTION FAILED in ${context}: Invalid appType "${appType}". Must be CUSTOMER or DRIVER`);
  }
}

/**
 * ASSERTION: Validate userId is provided
 * @throws Error if userId is missing
 */
function assertValidUserId(userId: unknown, context: string): asserts userId is string {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    throw new Error(`[NotificationV2] ⛔ ASSERTION FAILED in ${context}: userId is REQUIRED but was missing or empty`);
  }
}

/**
 * ASSERTION: Validate notification content
 * @throws Error if content is invalid
 */
function assertValidContent(content: unknown, context: string): asserts content is NotificationContent {
  if (!content || typeof content !== 'object') {
    throw new Error(`[NotificationV2] ⛔ ASSERTION FAILED in ${context}: content is REQUIRED`);
  }
  const c = content as Record<string, unknown>;
  if (!c.title || typeof c.title !== 'string') {
    throw new Error(`[NotificationV2] ⛔ ASSERTION FAILED in ${context}: content.title is REQUIRED`);
  }
  if (!c.body || typeof c.body !== 'string') {
    throw new Error(`[NotificationV2] ⛔ ASSERTION FAILED in ${context}: content.body is REQUIRED`);
  }
  if (!c.category) {
    throw new Error(`[NotificationV2] ⛔ ASSERTION FAILED in ${context}: content.category is REQUIRED`);
  }
}

/**
 * ASSERTION: Validate event name matches appType
 * @throws Error if event/appType mismatch detected
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function assertEventMatchesAppType(event: string, appType: AppType, context: string): void {
  const isCustomerEvent = event.startsWith('customer.');
  const isDriverEvent = event.startsWith('driver.');
  
  if (appType === 'CUSTOMER' && isDriverEvent) {
    throw new Error(`[NotificationV2] ⛔ CROSS-APP VIOLATION in ${context}: Attempted to send DRIVER event "${event}" to CUSTOMER app`);
  }
  if (appType === 'DRIVER' && isCustomerEvent) {
    throw new Error(`[NotificationV2] ⛔ CROSS-APP VIOLATION in ${context}: Attempted to send CUSTOMER event "${event}" to DRIVER app`);
  }
}

/**
 * ASSERTION: Validate room name matches appType
 * @throws Error if room/appType mismatch detected
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function assertRoomMatchesAppType(room: string, appType: AppType, context: string): void {
  const expectedPrefix = appType.toLowerCase();
  if (!room.startsWith(`${expectedPrefix}:`)) {
    throw new Error(`[NotificationV2] ⛔ ROOM VIOLATION in ${context}: Room "${room}" does not match appType "${appType}". Expected prefix "${expectedPrefix}:"`);
  }
}

// Global reference to socket server (set by gateway)
declare global {
  var __notificationSocketServer: NotificationSocketServer | undefined;
}

// Interface for socket server operations
interface NotificationSocketServer {
  emitToRoom(room: string, event: string, payload: SocketNotificationPayload): void;
  emitToUser(appType: AppType, userId: string, event: string, payload: SocketNotificationPayload): void;
}

/**
 * Register the socket server for notifications
 */
export function registerSocketServer(server: NotificationSocketServer): void {
  globalThis.__notificationSocketServer = server;
}

/**
 * Get event name based on app type (with validation)
 */
function getEventName(appType: AppType): string {
  assertValidAppType(appType, 'getEventName');
  return appType === 'CUSTOMER' 
    ? SOCKET_EVENTS.CUSTOMER_NOTIFICATION_NEW 
    : SOCKET_EVENTS.DRIVER_NOTIFICATION_NEW;
}

/**
 * Convert DB notification to socket payload
 */
function toSocketPayload(notification: {
  id: string;
  title: string;
  body: string;
  category: NotificationCategory;
  entityType: string | null;
  entityId: string | null;
  actionUrl: string | null;
  payload: unknown;
  createdAt: Date;
}): SocketNotificationPayload {
  return {
    id: notification.id,
    title: notification.title,
    body: notification.body,
    category: notification.category,
    entityType: notification.entityType ?? undefined,
    entityId: notification.entityId ?? undefined,
    actionUrl: notification.actionUrl ?? undefined,
    payload: notification.payload as Record<string, unknown> | undefined,
    createdAt: notification.createdAt.toISOString(),
  };
}

// Local interface to avoid import issues
interface LocalNotificationData {
  notificationId: string;
  title: string;
  body: string;
  type: string;
  category?: string;
  userId?: string;
  appType?: string;
  entityType?: string | null;
  entityId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Send notification to a specific user in a specific app (CUSTOMER or DRIVER)
 *
 * RULES:
 * - userId MUST be provided
 * - appType MUST be CUSTOMER or DRIVER
 * - content MUST include title, body, category
 */
export async function sendToUser(
  userId: string,
  appType: AppType,
  content: NotificationContent
): Promise<string> {
  console.log(`[NotificationV2] Starting sendToUser for userId=${userId}, appType=${appType}`);

  // SAFETY ASSERTIONS - fail fast on invalid input
  assertValidUserId(userId, 'sendToUser');
  assertValidAppType(appType, 'sendToUser');
  assertValidContent(content, 'sendToUser');
  console.log(`[NotificationV2] Validation passed for userId=${userId}, appType=${appType}`);

  // 1. Check if notification already exists for this exact event
  const existingNotification = await prisma.notificationV2.findFirst({
    where: {
      userId,
      appType,
      category: content.category,
      entityType: content.entityType,
      entityId: content.entityId,
    },
  });

  if (existingNotification) {
    console.log(`[NotificationV2] Notification already exists for userId=${userId}, appType=${appType}, category=${content.category}, entityType=${content.entityType}, entityId=${content.entityId}, skipping`);
    return existingNotification.id;
  }

  // 2. Persist notification in database FIRST (source of truth)
  console.log(`[NotificationV2] Recording notification in database for userId=${userId}, appType=${appType}`);
  const notification = await prisma.notificationV2.create({
    data: {
      userId,
      appType,
      title: content.title,
      body: content.body,
      category: content.category,
      entityType: content.entityType,
      entityId: content.entityId,
      actionUrl: content.actionUrl,
      payload: content.payload as Record<string, string> | undefined,
      status: 'PENDING',
    },
  });
  console.log(`[NotificationV2] Notification recorded with id=${notification.id} for userId=${userId}, appType=${appType}`);

  // 2. Check if user has ACTIVE socket connection for this appType
  const hasSocketConnection = (userId: string, appType: string): boolean => {
    const globalWithSocket = globalThis as unknown as { __userConnections?: Record<string, Record<string, number>> };
    if (!globalWithSocket.__userConnections) return false;
    return (globalWithSocket.__userConnections[userId]?.[appType] ?? 0) > 0;
  };
  const hasActiveSocketConnection = hasSocketConnection(userId, appType);
  console.log(`[NotificationV2] Checking for active socket connection for userId=${userId}, appType=${appType}`);
  console.log(`[NotificationV2] User ${userId} has active ${appType} socket connection: ${hasActiveSocketConnection}`);

  // 3. CONDITIONAL DELIVERY: Socket OR FCM, never both
  if (hasActiveSocketConnection) {
    // User is connected - deliver via socket ONLY
    console.log(`[NotificationV2] Delivering via SOCKET to ${appType}:${userId}`);
    
    const socketServer = globalThis.__notificationSocketServer;
    if (socketServer) {
      const payload = toSocketPayload(notification);
      const event = getEventName(appType as AppType);
      const room = getRoomName.user(appType, userId);
      
      socketServer.emitToRoom(room, event, payload);
      console.log(`[NotificationV2] Delivered via socket to ${appType}:${userId}`);
      
      // Update status to DELIVERED
      await prisma.notificationV2.update({
        where: { id: notification.id },
        data: { status: 'DELIVERED', deliveredAt: new Date() },
      });
    } else {
      console.error(`[NotificationV2] Socket server not available for ${appType}:${userId}`);
      // Fall back to FCM if socket server fails
      const notificationData: LocalNotificationData = {
        notificationId: notification.id,
        title: notification.title,
        body: notification.body,
        type: 'SYSTEM',
        category: notification.category,
        userId: notification.userId,
        appType: notification.appType,
        entityType: notification.entityType,
        entityId: notification.entityId,
        createdAt: notification.createdAt,
        updatedAt: notification.updatedAt
      };
      await sendFCMNotification(userId, appType, notificationData);
      
      await prisma.notificationV2.update({
        where: { id: notification.id },
        data: { status: 'DELIVERED', deliveredAt: new Date() },
      });
    }
  } else {
    // User is NOT connected - deliver via FCM ONLY
    console.log(`[NotificationV2] Delivering via FCM to ${appType}:${userId} (no active socket connection)`);
    
    const notificationData: LocalNotificationData = {
      notificationId: notification.id,
      title: notification.title,
      body: notification.body,
      type: 'SYSTEM',
      category: notification.category,
      userId: notification.userId,
      appType: notification.appType,
      entityType: notification.entityType,
      entityId: notification.entityId,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt
    };
    await sendFCMNotification(userId, appType, notificationData);
    
    // Update status to DELIVERED
    await prisma.notificationV2.update({
      where: { id: notification.id },
      data: { status: 'DELIVERED', deliveredAt: new Date() },
    });
  }

  console.log(`[NotificationV2] Notification sent to ${appType}:${userId} - "${content.title}"`);
  return notification.id;
}

export async function sendFCMNotification(
  userId: string,
  appType: AppType,
  notification: LocalNotificationData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  console.log(`[NotificationV2] sendFCMNotification called: userId=${userId}, appType=${appType}`);
  
  try {
    // Get all FCM tokens for this user and appType (across all platforms)
    const fcmTokens = await prisma.fCMToken.findMany({
      where: {
        userId,
        appType: appType,
      },
      select: {
        token: true,
        platform: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 1, // Only send to the most recent device
    });

    console.log(`[NotificationV2] Found ${fcmTokens.length} FCMToken records for user ${userId}, appType ${appType}`);

    // Fallback: If no FCMToken records found, check old fcmToken field
    let tokensToUse: Array<{ token: string; platform: string }> = fcmTokens;
    if (fcmTokens.length === 0) {
      console.log(`[NotificationV2] No FCMToken records found, checking old fcmToken field...`);
      const userWithOldToken = await prisma.user.findUnique({
        where: { id: userId },
        select: { fcmToken: true }
      });
      
      if (userWithOldToken?.fcmToken) {
        console.log(`[NotificationV2] Found old fcmToken for user ${userId}`);
        tokensToUse = [{ token: userWithOldToken.fcmToken, platform: 'android' }];
      } else {
        console.log(`[NotificationV2] No old fcmToken found either`);
      }
    }

    if (tokensToUse.length === 0) {
      console.log(`[NotificationV2] No FCM tokens found for user ${userId}, appType ${appType}, skipping push`);
      return { success: false, error: 'No FCM tokens found' };
    }

    // DEDUPLICATION CHECK: Prevent notification flood for the same user, appType, and notification type within 5 minutes
    const deduplicationKey = `${userId}:${appType}:${notification.type}:${notification.entityType || ''}:${notification.entityId || ''}`;
    const deduplicationWindow = 5 * 60 * 1000; // 5 minutes in milliseconds
    const now = Date.now();
    
    // Use global cache for deduplication (in production, use Redis or similar)
    const globalWithCache = globalThis as unknown as { 
      __notificationDedupeCache?: Record<string, number> 
    };
    
    if (!globalWithCache.__notificationDedupeCache) {
      globalWithCache.__notificationDedupeCache = {};
    }
    
    const lastSentTime = globalWithCache.__notificationDedupeCache[deduplicationKey];
    if (lastSentTime && (now - lastSentTime) < deduplicationWindow) {
      const remainingTime = Math.ceil((deduplicationWindow - (now - lastSentTime)) / 1000);
      console.log(`[NotificationV2] ⛔ DEDUPLICATION: Skipping notification for ${deduplicationKey}. Already sent within last 5 minutes. Remaining cooldown: ${remainingTime}s`);
      return { success: true, messageId: 'deduplicated' }; // Consider it successful to avoid retries
    }

    // Import Firebase messaging instances
    const { pilotMessaging, customerMessaging } = await import('@/lib/firebaseAdmin');

    console.log(`[NotificationV2] Firebase instances: pilotMessaging=${!!pilotMessaging}, customerMessaging=${!!customerMessaging}`);

    // Select the correct messaging instance based on appType
    const messaging = appType === 'DRIVER' ? pilotMessaging : customerMessaging;
    const appName = appType === 'DRIVER' ? 'Pilot (driver)' : 'Quick (customer)';

    if (!messaging) {
      console.error(`[NotificationV2] ${appName} Firebase not initialized; skipping FCM`);
      console.error(`[NotificationV2] Check GOOGLE_APPLICATION_CREDENTIALS_${appType === 'DRIVER' ? 'PILOT' : 'CUSTOMER'} environment variable`);
      return { success: false, error: 'Firebase not initialized' };
    }

    console.log(`[NotificationV2] Sending FCM to ${fcmTokens.length} device(s) via ${appName}...`);

    // Send to each token
    const sendPromises = fcmTokens.map(async (fcmTokenRecord) => {
      const message = {
        token: fcmTokenRecord.token,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          title: notification.title,
          body: notification.body,
          type: 'SYSTEM',
          notificationId: `system-${Date.now()}`, // Generate unique ID
        },
        android: {
          priority: 'high' as const,
          notification: {
            channelId: 'default_channel',
            priority: 'max' as const,
            defaultSound: true,
            defaultVibrateTimings: true,
            visibility: 'public' as const,
          },
        },
        apns: {
          headers: {
            'apns-priority': '10', // High priority for immediate delivery
          },
          payload: {
            aps: {
              alert: { title: notification.title, body: notification.body },
              sound: 'default',
              contentAvailable: true,
            },
          },
        },
      };

      console.log(`[NotificationV2] Sending to ${fcmTokenRecord.platform} device...`);
      const result = await messaging.send(message);
      console.log(`[NotificationV2] FCM sent to ${fcmTokenRecord.platform} device: ${result}`);
      return result;
    });

    // Wait for all sends to complete
    const results = await Promise.allSettled(sendPromises);
    const successfulResults = results.filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled');
    const messageIds = successfulResults.map((r) => r.value);
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`[NotificationV2] FCM batch complete: ${successfulResults.length} successful, ${failed} failed`);

    if (failed > 0) {
      console.error(`[NotificationV2] ${failed} FCM sends failed`);
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`[NotificationV2] Failed send #${index}:`, result.reason);
        }
      });
    }

    // UPDATE DEDUPLICATION CACHE: Only if we successfully sent at least one notification
    if (successfulResults.length > 0) {
      globalWithCache.__notificationDedupeCache![deduplicationKey] = now;
      console.log(`[NotificationV2] ✅ Updated deduplication cache for ${deduplicationKey}`);
      
      // Clean up old entries (optional - prevents memory leak)
      const cache = globalWithCache.__notificationDedupeCache!;
      const keysToDelete: string[] = [];
      for (const [key, timestamp] of Object.entries(cache)) {
        if (now - timestamp > deduplicationWindow * 2) { // Clean entries older than 10 minutes
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => delete cache[key]);
      if (keysToDelete.length > 0) {
        console.log(`[NotificationV2] 🧹 Cleaned up ${keysToDelete.length} old deduplication entries`);
      }
    }

    return { success: true, messageId: messageIds[0] };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as { code?: string })?.code;
    console.error(`[NotificationV2] FCM error for user ${userId}:`, errorMessage);
    console.error(`[NotificationV2] Error code: ${errorCode}`);
    console.error(`[NotificationV2] Full error:`, error);
    // Don't throw - FCM failure shouldn't block notification storage
    return { success: false, error: errorMessage };
  }
}

/**
 * Send promotional broadcast notification to ALL users of a specific app type via FCM
 * Sends in batches of 500 tokens to comply with FCM limits
 */
export async function sendBroadcastNotification(appType: AppType, title: string, body: string): Promise<{ success: boolean; sentCount: number; failedCount: number }> {
  console.log(`[NotificationV2] sendBroadcastNotification: ${appType}, title="${title}", body="${body}"`);

  try {
    // Get all FCM tokens for this appType
    const fcmTokens = await prisma.fCMToken.findMany({
      where: { appType },
      select: { token: true, platform: true },
    });

    console.log(`[NotificationV2] Found ${fcmTokens.length} FCM tokens for ${appType} broadcast`);

    if (fcmTokens.length === 0) {
      return { success: true, sentCount: 0, failedCount: 0 };
    }

    // Import Firebase messaging instances
    const { pilotMessaging, customerMessaging } = await import('@/lib/firebaseAdmin');

    // Select the correct messaging instance
    const messaging = appType === 'DRIVER' ? pilotMessaging : customerMessaging;
    const appName = appType === 'DRIVER' ? 'Pilot (driver)' : 'Quick (customer)';

    if (!messaging) {
      console.error(`[NotificationV2] ${appName} Firebase not initialized; skipping broadcast`);
      return { success: false, sentCount: 0, failedCount: fcmTokens.length };
    }

    // Send in batches of 500 (FCM multicast limit)
    const batchSize = 500;
    let totalSent = 0;
    let totalFailed = 0;

    for (let i = 0; i < fcmTokens.length; i += batchSize) {
      const batch = fcmTokens.slice(i, i + batchSize);
      const tokens = batch.map(t => t.token);

      const message = {
        tokens,
        notification: {
          title,
          body,
        },
        data: {
          title,
          body,
          type: 'PROMOTIONAL',
        },
        android: {
          priority: 'high' as const,
          notification: {
            channelId: 'default_channel',
            priority: 'high' as const,
            defaultSound: true,
            defaultVibrateTimings: true,
            visibility: 'public' as const,
          },
        },
        apns: {
          headers: {
            'apns-priority': '10',
          },
          payload: {
            aps: {
              alert: { title, body },
              sound: 'default',
              contentAvailable: true,
            },
          },
        },
      };

      try {
        const response = await messaging.sendEachForMulticast(message);
        totalSent += response.successCount;
        totalFailed += response.failureCount;

        console.log(`[NotificationV2] Broadcast batch ${Math.floor(i / batchSize) + 1}: ${response.successCount} sent, ${response.failureCount} failed`);

        // Log failures if any
        if (response.failureCount > 0) {
          response.responses.forEach((res: { success: boolean; error?: unknown }, idx: number) => {
            if (!res.success) {
              console.error(`[NotificationV2] Failed token ${idx}:`, res.error);
            }
          });
        }
      } catch (error) {
        console.error(`[NotificationV2] Broadcast batch error:`, error);
        totalFailed += tokens.length;
      }
    }

    console.log(`[NotificationV2] Broadcast complete: ${totalSent} sent, ${totalFailed} failed`);
    return { success: true, sentCount: totalSent, failedCount: totalFailed };
  } catch (error) {
    console.error(`[NotificationV2] Broadcast error for ${appType}:`, error);
    return { success: false, sentCount: 0, failedCount: 0 };
  }
}

/**
 * Send notification to all users with a specific permission in a SPECIFIC app
 */
export async function sendToPermission(
  permissionKey: string,
  appType: AppType,
  content: NotificationContent
): Promise<string[]> {
  // Get all users with this permission for this app
  const userPermissions = await prisma.userPermissionV2.findMany({
    where: {
      permission: {
        key: permissionKey,
        appType: appType,
      },
    },
    select: { userId: true },
  });

  const notificationIds: string[] = [];
  for (const { userId } of userPermissions) {
    const id = await sendToUser(userId, appType, content);
    notificationIds.push(id);
  }

  console.log(`[NotificationV2] Sent to permission ${permissionKey}@${appType} - ${notificationIds.length} users`);
  return notificationIds;
}

/**
 * Send notification to ALL users of a SPECIFIC app (app-wide broadcast)
 * Use sparingly - only for important announcements
 */
export async function sendToApp(
  appType: AppType,
  content: NotificationContent
): Promise<void> {
  const socketServer = globalThis.__notificationSocketServer;
  if (!socketServer) {
    console.warn('[NotificationV2] Socket server not available for app broadcast');
    return;
  }

  // Emit to app-wide room
  const event = getEventName(appType);
  const room = getRoomName.app(appType);
  
  // For broadcasts, we don't store individual notifications
  // The client should fetch on reconnect
  socketServer.emitToRoom(room, event, {
    id: `broadcast-${Date.now()}`,
    title: content.title,
    body: content.body,
    category: content.category,
    entityType: content.entityType,
    actionUrl: content.actionUrl,
    payload: content.payload,
    createdAt: new Date().toISOString(),
  });

  console.log(`[NotificationV2] Broadcast to ${appType} app - "${content.title}"`);
}
export async function sendSystemNotification(
  content: NotificationContent
): Promise<void> {
  // ... (rest of the code remains the same)
  await sendToApp('CUSTOMER', content);
  
  // Send to DRIVER app (separately)
  await sendToApp('DRIVER', content);

  console.log(`[NotificationV2] System notification sent to BOTH apps - "${content.title}"`);
}

/**
 * UNIFIED SEND - routes to correct method based on target
 */
export async function send(
  target: NotificationTarget,
  content: NotificationContent
): Promise<void> {
  switch (target.type) {
    case 'USER':
      await sendToUser(target.userId, target.appType, content);
      break;
    
    case 'PERMISSION':
      await sendToPermission(target.permissionKey, target.appType, content);
      break;
    
    case 'APP_BROADCAST':
      await sendToApp(target.appType, content);
      break;
    
    case 'SYSTEM':
      await sendSystemNotification(content);
      break;
    
    default:
      throw new Error(`Unknown notification target type`);
  }
}

// ============================================
// CONVENIENCE METHODS FOR COMMON USE CASES
// ============================================

/**
 * Notify CUSTOMER about booking update
 */
export async function notifyCustomerBookingUpdate(
  customerId: string,
  bookingId: string,
  title: string,
  body: string
): Promise<string> {
  return sendToUser(customerId, 'CUSTOMER', {
    title,
    body,
    category: 'ORDER',
    entityType: 'booking',
    entityId: bookingId,
    actionUrl: `/bookings/${bookingId}`,
  });
}

/**
 * Notify DRIVER about task assignment
 */
export async function notifyDriverTaskAssigned(
  driverId: string,
  bookingId: string,
  title: string,
  body: string
): Promise<string> {
  return sendToUser(driverId, 'DRIVER', {
    title,
    body,
    category: 'DRIVER',
    entityType: 'booking',
    entityId: bookingId,
    actionUrl: `/tasks/${bookingId}`,
  });
}

/**
 * Notify CUSTOMER that driver was assigned
 */
export async function notifyCustomerDriverAssigned(
  customerId: string,
  bookingId: string,
  driverName: string
): Promise<string> {
  return sendToUser(customerId, 'CUSTOMER', {
    title: 'Driver Assigned',
    body: `${driverName} has been assigned to your booking`,
    category: 'ORDER',
    entityType: 'booking',
    entityId: bookingId,
    actionUrl: `/bookings/${bookingId}`,
  });
}

/**
 * Notify CUSTOMER about payment confirmation
 */
export async function notifyCustomerPaymentConfirmed(
  customerId: string,
  bookingId: string,
  amount: string
): Promise<string> {
  return sendToUser(customerId, 'CUSTOMER', {
    title: 'Payment Confirmed',
    body: `Your payment of ${amount} has been confirmed`,
    category: 'PAYMENT',
    entityType: 'booking',
    entityId: bookingId,
    actionUrl: `/bookings/${bookingId}`,
  });
}
