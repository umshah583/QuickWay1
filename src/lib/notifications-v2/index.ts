/**
 * NOTIFICATION SYSTEM V2 - PUBLIC API
 * ====================================
 * Clean exports for the new notification system
 */

// Types
export * from './types';

// Notification Service
export {
  sendToUser,
  sendToPermission,
  sendToApp,
  sendSystemNotification,
  send,
  notifyCustomerBookingUpdate,
  notifyDriverTaskAssigned,
  notifyCustomerDriverAssigned,
  notifyCustomerPaymentConfirmed,
} from './notification-service';

// Socket Gateway
export {
  NotificationGatewayV2,
  initNotificationGateway,
  getNotificationGateway,
} from './socket-gateway';
