/**
 * ⛔ LEGACY PUSH SYSTEM - HARD DISABLED
 * =====================================
 * This file has been DISABLED as part of the Notification System V2 migration.
 * 
 * DO NOT USE THIS FILE.
 * ALL notification logic MUST go through: @/lib/notifications-v2
 * 
 * If you're seeing errors from this file, you need to migrate your code
 * to use the new notification system.
 * 
 * Migration guide:
 * - OLD: sendFCMNotificationToUser(userId, { title, body })
 * - NEW: import { sendToUser } from '@/lib/notifications-v2'
 *        sendToUser(userId, 'CUSTOMER', { title, body, category: 'ORDER' })
 * 
 * @deprecated Use @/lib/notifications-v2 instead
 */

const LEGACY_ERROR_MESSAGE = `
⛔ LEGACY PUSH SYSTEM IS DISABLED ⛔

This code path uses the DEPRECATED push.ts system which has been
disabled to prevent cross-app notification delivery bugs.

The old system used ROLE-BASED routing which caused:
- Customer apps receiving driver notifications
- Driver apps receiving customer notifications

ALL push notifications MUST use the new system:
  import { sendToUser } from '@/lib/notifications-v2';
  sendToUser(userId, 'CUSTOMER', { title, body, category: 'ORDER' });

DO NOT attempt to fix this by re-enabling legacy code.
Migrate to notifications-v2 instead.
`;

// Type exports for backward compatibility (will cause runtime errors if used)
export type FCMPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
};

/**
 * @deprecated DISABLED - Use @/lib/notifications-v2 instead
 * @throws Error Always throws - legacy system is disabled
 */
export async function sendFCMNotificationToUser(): Promise<never> {
  console.error(LEGACY_ERROR_MESSAGE);
  throw new Error('LEGACY_DISABLED: sendFCMNotificationToUser() is disabled. Use @/lib/notifications-v2');
}

/**
 * @deprecated DISABLED - Use @/lib/notifications-v2 instead
 * @throws Error Always throws - legacy system is disabled
 */
export async function sendPushNotificationToUser(): Promise<never> {
  console.error(LEGACY_ERROR_MESSAGE);
  throw new Error('LEGACY_DISABLED: sendPushNotificationToUser() is disabled. Use @/lib/notifications-v2');
}
