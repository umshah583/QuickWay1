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
  // Only record notifications that have a userId
  // Admin/system notifications without a userId are not stored in the database
  if (!userId) {
    console.log("[AdminNotification] Skipping database record for notification without userId:", { title, category });
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
        userId,
      },
    });
  } catch (error) {
    console.error("Failed to record notification", error);
  }
}
