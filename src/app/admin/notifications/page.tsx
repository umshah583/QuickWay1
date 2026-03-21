import { prisma } from "@/lib/prisma";
import { NotificationCenterClient } from "./NotificationCenterClient";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  // Fetch all notifications
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Calculate stats
  const totalNotifications = notifications.length;
  const unreadCount = notifications.filter(n => !n.read).length;
  const readCount = notifications.filter(n => n.read).length;

  return (
    <NotificationCenterClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      notifications={notifications as any}
      totalNotifications={totalNotifications}
      unreadCount={unreadCount}
      readCount={readCount}
    />
  );
}
