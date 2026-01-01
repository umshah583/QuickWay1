import { publishLiveUpdate } from '@/lib/liveUpdates';
import { prisma } from '@/lib/prisma';

// =============================================
// SIMPLIFIED EVENT EMISSION SYSTEM
// =============================================
// Only use Socket.IO broadcasts - no complex notification system

export type BusinessEvent =
  // Booking lifecycle
  | 'booking.created'
  | 'booking.updated'
  | 'booking.assigned'
  | 'booking.unassigned'
  | 'booking.reassigned'
  | 'booking.started'
  | 'booking.completed'
  | 'booking.cancelled'
  | 'booking.deleted'
  | 'booking.payment_updated'
  | 'booking.cash_collected'

  // Driver status
  | 'driver.online'
  | 'driver.offline'
  | 'driver.location_updated'

  // Subscription/Request events
  | 'subscription.approved'
  | 'subscription.rejected'
  | 'subscription.payment_confirmed'

  // System
  | 'system.announcement'
  | 'system.maintenance';

export interface BusinessEventContext {
  bookingId?: string;
  userId?: string;        // customer or driver ID
  driverId?: string;      // specific driver ID
  serviceName?: string;
  driverName?: string;
  previousDriverId?: string;
  newDriverId?: string;
  status?: string;
  message?: string;
  title?: string;         // for system notifications
  amount?: number;
  requestId?: string;     // for subscription requests
  reason?: string;        // for rejection reason
  subscriptionName?: string; // for subscription notifications
}

// =============================================
// SIMPLIFIED EVENT DISPATCHER
// =============================================

export function emitBusinessEvent(
  event: BusinessEvent,
  context: BusinessEventContext
): void {
  console.log(`[BusinessEvent] 🚀 EMITTING EVENT: ${event}`);
  console.log(`[BusinessEvent] 📦 Context:`, JSON.stringify(context, null, 2));

  // Validate required context
  if (!context.bookingId && ['booking.created', 'booking.updated', 'booking.assigned', 'booking.unassigned', 'booking.reassigned', 'booking.started', 'booking.completed', 'booking.cancelled', 'booking.deleted', 'booking.payment_updated', 'booking.cash_collected'].includes(event)) {
    throw new Error(`BusinessEvent ${event} requires bookingId`);
  }

  try {
    switch (event) {
    // ============================================
    // BOOKING LIFECYCLE EVENTS
    // ============================================

    case 'booking.created':
      emitBookingCreated(context);
      break;

    case 'booking.updated':
      emitBookingUpdated(context);
      break;

    case 'booking.assigned':
      emitBookingAssigned(context);
      break;

    case 'booking.unassigned':
      emitBookingUnassigned(context);
      break;

    case 'booking.reassigned':
      emitBookingReassigned(context);
      break;

    case 'booking.started':
      emitBookingStarted(context);
      break;

    case 'booking.completed':
      emitBookingCompleted(context);
      break;

    case 'booking.cancelled':
      emitBookingCancelled(context);
      break;

    case 'booking.deleted':
      emitBookingDeleted(context);
      break;

    case 'booking.payment_updated':
      emitBookingPaymentUpdated(context);
      break;

    case 'booking.cash_collected':
      emitBookingCashCollected(context);
      break;

    // ============================================
    // DRIVER STATUS EVENTS
    // ============================================

    case 'driver.online':
      emitDriverOnline(context);
      break;

    case 'driver.offline':
      emitDriverOffline(context);
      break;

    case 'driver.location_updated':
      emitDriverLocationUpdated(context);
      break;

    // ============================================
    // SUBSCRIPTION/REQUEST EVENTS
    // ============================================

    case 'subscription.approved':
      emitSubscriptionApproved(context);
      break;

    case 'subscription.rejected':
      emitSubscriptionRejected(context);
      break;

    case 'subscription.payment_confirmed':
      emitSubscriptionPaymentConfirmed(context);
      break;

    // ============================================
    // SYSTEM EVENTS
    // ============================================

    case 'system.announcement':
      emitSystemAnnouncement(context);
      break;

    case 'system.maintenance':
      emitSystemMaintenance(context);
      break;

    default:
      throw new Error(`Unknown business event: ${event}`);
  }

  console.log(`[BusinessEvent] ✅ EVENT EMITTED: ${event}`);
  } catch (error) {
    console.error(`[BusinessEvent] ❌ ERROR EMITTING EVENT ${event}:`, error);
    throw error; // Re-throw to let caller handle
  }
}

// =============================================
// EVENT IMPLEMENTATIONS - ONLY SOCKET.IO BROADCASTS
// =============================================

async function emitBookingCreated(context: BusinessEventContext): Promise<void> {
  const { bookingId, userId, serviceName } = context;
  if (!bookingId || !userId) throw new Error('booking.created requires bookingId and userId');

  publishLiveUpdate(
    { type: 'bookings.updated', bookingId, userId },
    { userIds: [userId] }
  );

  // Send FCM push notification
  const title = 'Booking Confirmed! ✅';
  const body = serviceName ? `Your ${serviceName} booking has been confirmed.` : 'Your booking has been confirmed.';
  await sendFCMToUser(userId, 'CUSTOMER', title, body, { type: 'BOOKING_CREATED', bookingId });
}

async function emitBookingUpdated(context: BusinessEventContext): Promise<void> {
  const { bookingId, userId } = context;
  if (!bookingId || !userId) throw new Error('booking.updated requires bookingId and userId');

  publishLiveUpdate(
    { type: 'bookings.updated', bookingId, userId },
    { userIds: [userId] }
  );

  // Send FCM push notification
  await sendFCMToUser(userId, 'CUSTOMER', 'Booking Updated', 'Your booking has been updated.', { type: 'BOOKING_UPDATED', bookingId });
}

async function emitBookingAssigned(context: BusinessEventContext): Promise<void> {
  const { bookingId, userId, driverId, driverName } = context;
  if (!bookingId || !userId || !driverId) throw new Error('booking.assigned requires bookingId, userId, driverId');

  // Customer gets booking update
  publishLiveUpdate(
    { type: 'bookings.updated', bookingId, userId },
    { userIds: [userId] }
  );

  // Driver gets assignment notification
  publishLiveUpdate(
    { type: 'generic', payload: { event: 'driver.assigned', bookingId, driverId } },
    { userIds: [driverId] }
  );

  // FCM to customer
  const customerBody = driverName ? `${driverName} has been assigned to your booking.` : 'A driver has been assigned to your booking.';
  await sendFCMToUser(userId, 'CUSTOMER', 'Driver Assigned 🚗', customerBody, { type: 'BOOKING_ASSIGNED', bookingId });

  // FCM to driver
  await sendFCMToUser(driverId, 'DRIVER', 'New Assignment 📋', 'You have been assigned a new job.', { type: 'DRIVER_ASSIGNED', bookingId });
}

async function emitBookingUnassigned(context: BusinessEventContext): Promise<void> {
  const { bookingId, userId, previousDriverId } = context;
  if (!bookingId || !userId || !previousDriverId) throw new Error('booking.unassigned requires bookingId, userId, previousDriverId');

  // Customer gets booking update
  publishLiveUpdate(
    { type: 'bookings.updated', bookingId, userId },
    { userIds: [userId] }
  );

  // Previous driver gets unassignment notification
  publishLiveUpdate(
    { type: 'generic', payload: { event: 'driver.unassigned', bookingId, driverId: previousDriverId } },
    { userIds: [previousDriverId] }
  );

  // FCM to driver
  await sendFCMToUser(previousDriverId, 'DRIVER', 'Assignment Removed', 'You have been unassigned from a job.', { type: 'DRIVER_UNASSIGNED', bookingId });
}

async function emitBookingReassigned(context: BusinessEventContext): Promise<void> {
  const { bookingId, userId, previousDriverId, newDriverId } = context;
  if (!bookingId || !userId || !previousDriverId || !newDriverId) throw new Error('booking.reassigned requires bookingId, userId, previousDriverId, newDriverId');

  await emitBookingUnassigned({ bookingId, userId, previousDriverId });
  await emitBookingAssigned({ bookingId, userId, driverId: newDriverId });
}

async function emitBookingStarted(context: BusinessEventContext): Promise<void> {
  const { bookingId, userId, driverId, driverName } = context;
  if (!bookingId || !userId || !driverId) throw new Error('booking.started requires bookingId, userId, driverId');

  publishLiveUpdate(
    { type: 'bookings.updated', bookingId, userId },
    { userIds: [userId] }
  );

  publishLiveUpdate(
    { type: 'generic', payload: { event: 'driver.started', bookingId, driverId } },
    { userIds: [driverId] }
  );

  // FCM to customer
  const body = driverName ? `${driverName} has started working on your car.` : 'Your car wash has started!';
  await sendFCMToUser(userId, 'CUSTOMER', 'Service Started 🚿', body, { type: 'BOOKING_STARTED', bookingId });
}

async function emitBookingCompleted(context: BusinessEventContext): Promise<void> {
  const { bookingId, userId, driverId } = context;
  if (!bookingId || !userId || !driverId) throw new Error('booking.completed requires bookingId, userId, driverId');

  publishLiveUpdate(
    { type: 'bookings.updated', bookingId, userId },
    { userIds: [userId] }
  );

  publishLiveUpdate(
    { type: 'generic', payload: { event: 'driver.completed', bookingId, driverId } },
    { userIds: [driverId] }
  );

  // FCM to customer
  await sendFCMToUser(userId, 'CUSTOMER', 'Service Completed! ✨', 'Your car wash is complete. Thank you for choosing us!', { type: 'BOOKING_COMPLETED', bookingId });
}

async function emitBookingCancelled(context: BusinessEventContext): Promise<void> {
  const { bookingId, userId, driverId } = context;
  if (!bookingId || !userId) throw new Error('booking.cancelled requires bookingId and userId');

  publishLiveUpdate(
    { type: 'bookings.updated', bookingId, userId },
    { userIds: [userId] }
  );

  // FCM to customer
  await sendFCMToUser(userId, 'CUSTOMER', 'Booking Cancelled', 'Your booking has been cancelled.', { type: 'BOOKING_CANCELLED', bookingId });

  if (driverId) {
    publishLiveUpdate(
      { type: 'generic', payload: { event: 'driver.cancelled', bookingId, driverId } },
      { userIds: [driverId] }
    );
    // FCM to driver
    await sendFCMToUser(driverId, 'DRIVER', 'Job Cancelled', 'A booking you were assigned to has been cancelled.', { type: 'BOOKING_CANCELLED', bookingId });
  }
}

async function emitBookingDeleted(context: BusinessEventContext): Promise<void> {
  const { bookingId, userId, driverId } = context;
  if (!bookingId || !userId) throw new Error('booking.deleted requires bookingId and userId');

  publishLiveUpdate(
    { type: 'bookings.updated', bookingId, userId },
    { userIds: [userId] }
  );

  if (driverId) {
    publishLiveUpdate(
      { type: 'generic', payload: { event: 'driver.booking_deleted', bookingId, driverId } },
      { userIds: [driverId] }
    );
    await sendFCMToUser(driverId, 'DRIVER', 'Job Removed', 'A booking has been removed from your assignments.', { type: 'BOOKING_DELETED', bookingId });
  }
}

async function emitBookingPaymentUpdated(context: BusinessEventContext): Promise<void> {
  const { bookingId, userId, status } = context;
  if (!bookingId || !userId) throw new Error('booking.payment_updated requires bookingId and userId');

  publishLiveUpdate(
    { type: 'bookings.updated', bookingId, userId },
    { userIds: [userId] }
  );

  // FCM to customer
  const title = status === 'PAID' ? 'Payment Confirmed! ✅' : 'Payment Updated';
  const body = status === 'PAID' ? 'Your payment has been confirmed.' : 'Your booking payment status has been updated.';
  await sendFCMToUser(userId, 'CUSTOMER', title, body, { type: 'PAYMENT_UPDATED', bookingId, status: status || '' });
}

async function emitBookingCashCollected(context: BusinessEventContext): Promise<void> {
  const { bookingId, userId, driverId, amount } = context;
  if (!bookingId || !userId || !driverId) throw new Error('booking.cash_collected requires bookingId, userId, driverId');

  publishLiveUpdate(
    { type: 'bookings.updated', bookingId, userId },
    { userIds: [userId] }
  );

  publishLiveUpdate(
    { type: 'generic', payload: { event: 'driver.cash_collected', bookingId, driverId } },
    { userIds: [driverId] }
  );

  // FCM to customer
  const customerBody = amount ? `Cash payment of AED ${amount} has been collected.` : 'Your cash payment has been collected.';
  await sendFCMToUser(userId, 'CUSTOMER', 'Payment Collected 💰', customerBody, { type: 'CASH_COLLECTED', bookingId });
}

function emitDriverOnline(context: BusinessEventContext): void {
  const { driverId } = context;
  if (!driverId) throw new Error('driver.online requires driverId');
  console.log(`[BusinessEvent] Driver ${driverId} is now online`);
}

function emitDriverOffline(context: BusinessEventContext): void {
  const { driverId } = context;
  if (!driverId) throw new Error('driver.offline requires driverId');
  console.log(`[BusinessEvent] Driver ${driverId} is now offline`);
}

function emitDriverLocationUpdated(context: BusinessEventContext): void {
  // Location updates are frequent and don't need notifications
}

async function emitSystemAnnouncement(context: BusinessEventContext): Promise<void> {
  const { message, title } = context;
  if (!message) throw new Error('system.announcement requires message');

  const notificationTitle = title || 'System Notification';
  const notificationId = `system-${Date.now()}`;

  // 1. Broadcast via Socket.IO for connected clients
  publishLiveUpdate(
    {
      type: 'system.notification.new',
      id: notificationId,
      title: notificationTitle,
      message,
      createdAt: new Date().toISOString()
    },
    { room: 'system' } // Target system room
  );

  // 2. Send FCM push notifications to ALL users for background/killed app state
  try {
    console.log('[SystemAnnouncement] 📱 Sending FCM push notifications to all users...');
    
    // Get all FCM tokens from database
    const allTokens = await prisma.fCMToken.findMany({
      select: {
        token: true,
        appType: true,
        platform: true,
        userId: true,
      }
    });

    console.log(`[SystemAnnouncement] Found ${allTokens.length} FCM tokens`);

    if (allTokens.length === 0) {
      console.log('[SystemAnnouncement] No FCM tokens found, skipping push notifications');
      return;
    }

    // Import Firebase messaging instances
    const { pilotMessaging, customerMessaging } = await import('@/lib/firebaseAdmin');

    // Group tokens by appType
    const customerTokens = allTokens.filter(t => t.appType === 'CUSTOMER').map(t => t.token);
    const driverTokens = allTokens.filter(t => t.appType === 'DRIVER').map(t => t.token);

    console.log(`[SystemAnnouncement] Customer tokens: ${customerTokens.length}, Driver tokens: ${driverTokens.length}`);

    // Send to customer app tokens
    if (customerTokens.length > 0 && customerMessaging) {
      try {
        // Send in batches of 500 (FCM limit)
        for (let i = 0; i < customerTokens.length; i += 500) {
          const batch = customerTokens.slice(i, i + 500);
          const response = await customerMessaging.sendEachForMulticast({
            tokens: batch,
            // MUST include notification field for killed app on Android
            // Android system tray handles display when app is killed
            notification: {
              title: notificationTitle,
              body: message,
            },
            data: {
              type: 'SYSTEM',
              notificationId: notificationId,
              title: notificationTitle,
              body: message,
            },
            android: {
              priority: 'high',
              notification: {
                channelId: 'default_channel', // Must match Android app's channel
                priority: 'high',
                sound: 'default',
              },
            },
            apns: {
              headers: {
                'apns-priority': '10',
              },
              payload: {
                aps: {
                  alert: {
                    title: notificationTitle,
                    body: message,
                  },
                  sound: 'default',
                  'content-available': 1,
                },
              },
            },
          });
          console.log(`[SystemAnnouncement] ✅ Customer FCM batch sent: ${response.successCount} success, ${response.failureCount} failed`);
          if (response.failureCount > 0) {
            response.responses.forEach((resp, idx) => {
              if (!resp.success) {
                console.error(`[SystemAnnouncement] Token ${idx} failed:`, resp.error);
              }
            });
          }
        }
      } catch (error) {
        console.error('[SystemAnnouncement] ❌ Failed to send FCM to customer tokens:', error);
      }
    }

    // Send to driver app tokens
    if (driverTokens.length > 0 && pilotMessaging) {
      try {
        for (let i = 0; i < driverTokens.length; i += 500) {
          const batch = driverTokens.slice(i, i + 500);
          const response = await pilotMessaging.sendEachForMulticast({
            tokens: batch,
            // MUST include notification field for killed app on Android
            notification: {
              title: notificationTitle,
              body: message,
            },
            data: {
              type: 'SYSTEM',
              notificationId: notificationId,
              title: notificationTitle,
              body: message,
            },
            android: {
              priority: 'high',
              notification: {
                channelId: 'default_channel', // Must match Android app's channel
                priority: 'high',
                sound: 'default',
              },
            },
            apns: {
              headers: {
                'apns-priority': '10',
              },
              payload: {
                aps: {
                  alert: {
                    title: notificationTitle,
                    body: message,
                  },
                  sound: 'default',
                  'content-available': 1,
                },
              },
            },
          });
          console.log(`[SystemAnnouncement] ✅ Driver FCM batch sent: ${response.successCount} success, ${response.failureCount} failed`);
          if (response.failureCount > 0) {
            response.responses.forEach((resp, idx) => {
              if (!resp.success) {
                console.error(`[SystemAnnouncement] Driver token ${idx} failed:`, resp.error);
              }
            });
          }
        }
      } catch (error) {
        console.error('[SystemAnnouncement] ❌ Failed to send FCM to driver tokens:', error);
      }
    }

    console.log('[SystemAnnouncement] ✅ FCM push notifications sent successfully');
  } catch (error) {
    console.error('[SystemAnnouncement] ❌ Error sending FCM push notifications:', error);
    // Don't throw - socket notification was already sent
  }
}

function emitSystemMaintenance(context: BusinessEventContext): void {
  const { message } = context;

  publishLiveUpdate(
    { type: 'generic', payload: { event: 'system.maintenance', message: message || 'System maintenance in progress' } },
    undefined // broadcast to all
  );
}

// =============================================
// SUBSCRIPTION/REQUEST EVENT IMPLEMENTATIONS
// =============================================

async function emitSubscriptionApproved(context: BusinessEventContext): Promise<void> {
  const { userId, requestId, subscriptionName } = context;
  if (!userId) throw new Error('subscription.approved requires userId');

  // Socket update for connected users only - FCM handled by API routes
  publishLiveUpdate(
    { type: 'generic', payload: { event: 'subscription.approved', requestId, userId } },
    { userIds: [userId] }
  );

  // FCM push notification is handled by the API route using the new notification service
}

async function emitSubscriptionRejected(context: BusinessEventContext): Promise<void> {
  const { userId, requestId, reason, subscriptionName } = context;
  if (!userId) throw new Error('subscription.rejected requires userId');

  // Socket update for connected users only - FCM handled by API routes
  publishLiveUpdate(
    { type: 'generic', payload: { event: 'subscription.rejected', requestId, userId, reason } },
    { userIds: [userId] }
  );

  // FCM push notification is handled by the API route using the new notification service
}

async function emitSubscriptionPaymentConfirmed(context: BusinessEventContext): Promise<void> {
  const { userId, requestId, subscriptionName } = context;
  if (!userId) throw new Error('subscription.payment_confirmed requires userId');

  // Socket update for connected users only - FCM handled by API routes
  publishLiveUpdate(
    { type: 'generic', payload: { event: 'subscription.payment_confirmed', requestId, userId } },
    { userIds: [userId] }
  );

  // FCM push notification is handled by the API route using the new notification service
}

// =============================================
// UNIFIED FCM PUSH NOTIFICATION HELPER
// =============================================

async function sendFCMToUser(
  userId: string,
  appType: 'CUSTOMER' | 'DRIVER',
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<void> {
  try {
    console.log(`[FCM] 📱 Sending push to ${appType}:${userId} - "${title}"`);

    // Get FCM tokens for this user and appType
    const tokens = await prisma.fCMToken.findMany({
      where: { userId, appType },
      select: { token: true }
    });

    if (tokens.length === 0) {
      console.log(`[FCM] No tokens found for ${appType}:${userId}`);
      return;
    }

    const tokenList = tokens.map(t => t.token);
    const { pilotMessaging, customerMessaging } = await import('@/lib/firebaseAdmin');
    const messaging = appType === 'DRIVER' ? pilotMessaging : customerMessaging;

    if (!messaging) {
      console.error(`[FCM] Firebase messaging not available for ${appType}`);
      return;
    }

    const response = await messaging.sendEachForMulticast({
      tokens: tokenList,
      notification: { title, body },
      data: { ...data, title, body },
      android: {
        priority: 'high',
        notification: {
          channelId: 'default_channel',
          priority: 'high',
          sound: 'default',
        },
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: {
          aps: {
            alert: { title, body },
            sound: 'default',
            'content-available': 1,
          },
        },
      },
    });

    console.log(`[FCM] ✅ Sent to ${appType}:${userId}: ${response.successCount} success, ${response.failureCount} failed`);
  } catch (error) {
    console.error(`[FCM] ❌ Error sending to ${appType}:${userId}:`, error);
  }
}
