import { NotificationCategory } from "@prisma/client";
import prisma from "@/lib/prisma";

export type NotificationInput = {
  title: string;
  message: string;
  category: NotificationCategory;
  entityType?: string | null;
  entityId?: string | null;
  userId?: string | null;
};

export async function recordNotification({ title, message, category, entityType, entityId, userId }: NotificationInput) {
  // For system notifications without a userId, don't create a database record
  // These are admin/system notifications that don't need to be stored
  if (!userId) {
    console.log("[AdminNotification] Skipping database record for system notification without userId:", { title, category });
    return;
  }

  try {
    await prisma.notification.create({
      data: {
        title,
        message,
        category,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        userId, // userId is guaranteed to be defined here
      },
    });
    console.log(`[AdminNotification] Recorded notification: ${title} (${category})`);
  } catch (error) {
    console.error("Failed to record notification", error);
  }
}
