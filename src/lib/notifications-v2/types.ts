/**
 * NOTIFICATION SYSTEM V2 - TYPE DEFINITIONS
 * ==========================================
 * Clean-slate types with ZERO legacy dependencies
 */

import type { NotificationCategory } from '@prisma/client';

// Application types - MUST match Prisma enum
export type AppType = 'CUSTOMER' | 'DRIVER';

// Notification status
export type NotificationStatus = 'PENDING' | 'DELIVERED' | 'READ' | 'FAILED';

// Socket authentication payload
export interface SocketAuthPayload {
  userId: string;
  appType: AppType;
  permissions: string[];
}

// Notification content
export interface NotificationContent {
  title: string;
  body: string;
  category: NotificationCategory;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  payload?: Record<string, unknown>;
}

// Target types for notification delivery
export type NotificationTarget =
  | { type: 'USER'; userId: string; appType: AppType }
  | { type: 'PERMISSION'; permissionKey: string; appType: AppType }
  | { type: 'APP_BROADCAST'; appType: AppType }
  | { type: 'SYSTEM'; }; // Sends to BOTH apps separately

// Socket event names - EXPLICIT per app
export const SOCKET_EVENTS = {
  // Customer-specific events
  CUSTOMER_NOTIFICATION_NEW: 'customer.notification.new',
  CUSTOMER_NOTIFICATION_COUNT: 'customer.notification.count',
  
  // Driver-specific events
  DRIVER_NOTIFICATION_NEW: 'driver.notification.new',
  DRIVER_NOTIFICATION_COUNT: 'driver.notification.count',
  
  // System events (sent to both, but separately)
  SYSTEM_NOTIFICATION_NEW: 'system.notification.new',
} as const;

// Socket room naming conventions
export const getRoomName = {
  // User-specific room (prefixed by app)
  user: (appType: AppType, userId: string) => `${appType.toLowerCase()}:user:${userId}`,
  
  // App-wide room
  app: (appType: AppType) => `${appType.toLowerCase()}:all`,
  
  // Permission-based room (prefixed by app)
  permission: (appType: AppType, permissionKey: string) => `${appType.toLowerCase()}:perm:${permissionKey}`,
};

// Notification payload sent over socket
export interface SocketNotificationPayload {
  id: string;
  title: string;
  body: string;
  category: NotificationCategory;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

// API response types
export interface NotificationListResponse {
  notifications: SocketNotificationPayload[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface UnreadCountResponse {
  count: number;
}

export interface MarkReadResponse {
  success: boolean;
  markedCount: number;
}
