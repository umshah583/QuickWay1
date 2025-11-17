import { NotificationCategory } from "@prisma/client";
import prisma from "@/lib/prisma";

export type NotificationInput = {
  title: string;
  message: string;
  category: NotificationCategory;
  entityType?: string | null;
  entityId?: string | null;
};

export async function recordNotification({ title, message, category, entityType, entityId }: NotificationInput) {
  try {
    await prisma.notification.create({
      data: {
        title,
        message,
        category,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to record notification", error);
  }
}
