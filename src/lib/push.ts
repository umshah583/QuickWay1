import webpush from "web-push";
import { prisma } from "@/lib/prisma";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";

let isConfigured = false;

function ensureConfigured(): boolean {
  if (isConfigured) {
    return true;
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("Push notifications disabled: missing VAPID keys");
    return false;
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  isConfigured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
};

type WebPushErrorLike = {
  statusCode?: number;
};

function isWebPushError(error: unknown): error is WebPushErrorLike {
  return typeof error === "object" && error !== null && "statusCode" in error;
}

export async function sendPushNotificationToUser(userId: string, payload: PushPayload) {
  if (!ensureConfigured()) {
    return;
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  });

  if (subscriptions.length === 0) {
    return;
  }

  const message = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          message,
        );
      } catch (error) {
        if (isWebPushError(error) && (error.statusCode === 404 || error.statusCode === 410)) {
          await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
        } else {
          console.error("Failed to send push notification", error);
        }
      }
    }),
  );
}
