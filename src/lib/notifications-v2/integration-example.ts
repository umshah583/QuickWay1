/**
 * NOTIFICATION V2 - INTEGRATION EXAMPLES
 * =======================================
 * How to use the new notification system in your business logic
 */

import {
  notifyCustomerBookingUpdate,
  notifyDriverTaskAssigned,
  notifyCustomerDriverAssigned,
  notifyCustomerPaymentConfirmed,
  sendToUser,
  sendToApp,
  sendSystemNotification,
} from './index';

// ============================================
// BOOKING FLOW EXAMPLES
// ============================================

/**
 * When admin assigns a driver to a booking
 */
export async function onDriverAssigned(
  customerId: string,
  driverId: string,
  bookingId: string,
  driverName: string
): Promise<void> {
  // 1. Notify DRIVER (DRIVER app only) - Task assignment
  await notifyDriverTaskAssigned(
    driverId,
    bookingId,
    'New Task Assigned',
    'You have been assigned a new service task. Please check your dashboard.'
  );

  // 2. Notify CUSTOMER (CUSTOMER app only) - Driver assigned
  await notifyCustomerDriverAssigned(customerId, bookingId, driverName);

  // NOTE: These are COMPLETELY ISOLATED
  // - Driver notification goes to DRIVER app ONLY
  // - Customer notification goes to CUSTOMER app ONLY
  // - ZERO cross-contamination possible
}

/**
 * When driver starts the task
 */
export async function onTaskStarted(
  customerId: string,
  driverId: string,
  bookingId: string
): Promise<void> {
  // Notify CUSTOMER only
  await notifyCustomerBookingUpdate(
    customerId,
    bookingId,
    'Service Started',
    'Your service has started. The driver is now working on your vehicle.'
  );

  // Driver does NOT need notification - they initiated the action
}

/**
 * When driver completes the task
 */
export async function onTaskCompleted(
  customerId: string,
  driverId: string,
  bookingId: string
): Promise<void> {
  // Notify CUSTOMER only
  await notifyCustomerBookingUpdate(
    customerId,
    bookingId,
    'Service Completed',
    'Your service has been completed. Thank you for choosing Quick Way!'
  );
}

/**
 * When payment is confirmed
 */
export async function onPaymentConfirmed(
  customerId: string,
  bookingId: string,
  amount: string
): Promise<void> {
  // Notify CUSTOMER only
  await notifyCustomerPaymentConfirmed(customerId, bookingId, amount);
}

// ============================================
// BROADCAST EXAMPLES
// ============================================

/**
 * Send promotion to all customers
 */
export async function sendCustomerPromotion(
  title: string,
  body: string
): Promise<void> {
  await sendToApp('CUSTOMER', {
    title,
    body,
    category: 'SYSTEM',
  });
}

/**
 * Send announcement to all drivers
 */
export async function sendDriverAnnouncement(
  title: string,
  body: string
): Promise<void> {
  await sendToApp('DRIVER', {
    title,
    body,
    category: 'SYSTEM',
  });
}

/**
 * Send system maintenance notice to BOTH apps
 */
export async function sendMaintenanceNotice(
  title: string,
  body: string
): Promise<void> {
  // This sends to BOTH apps, but SEPARATELY
  // Each app receives its own event
  await sendSystemNotification({
    title,
    body,
    category: 'SYSTEM',
  });
}

// ============================================
// CUSTOM NOTIFICATION EXAMPLE
// ============================================

/**
 * Send custom notification to specific user in specific app
 */
export async function sendCustomNotification(
  userId: string,
  appType: 'CUSTOMER' | 'DRIVER',
  title: string,
  body: string,
  entityType?: string,
  entityId?: string
): Promise<string> {
  return sendToUser(userId, appType, {
    title,
    body,
    category: 'ORDER',
    entityType,
    entityId,
  });
}
