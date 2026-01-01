import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Prisma, NotificationCategory } from "@prisma/client";
import prisma from "@/lib/prisma";
import { toggleNotificationRead, markAllNotificationsRead } from "./actions";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  ORDER: "Orders",
  DRIVER: "Drivers",
  CUSTOMER: "Customers",
  PAYMENT: "Payments",
  SYSTEM: "System",
  PROMOTIONAL: "Promotional",
};

type NotificationRecord = Prisma.NotificationGetPayload<{
  select: {
    id: true;
    title: true;
    message: true;
    category: true;
    entityType: true;
    entityId: true;
    read: true;
    createdAt: true;
  };
}>;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function parseParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function parseCategory(raw: string): NotificationCategory | undefined {
  const upper = raw.toUpperCase();
  return Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, upper)
    ? (upper as NotificationCategory)
    : undefined;
}

function parseState(raw: string) {
  const value = raw.toLowerCase();
  if (value === "read" || value === "unread") return value;
  return "";
}

export default async function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const queryRaw = parseParam(params.q).trim();
  const categoryFilter = parseCategory(parseParam(params.category));
  const stateFilter = parseState(parseParam(params.state));

  const textFilters: Prisma.NotificationWhereInput[] | undefined = queryRaw
    ? [
        { title: { contains: queryRaw } },
        { message: { contains: queryRaw } },
      ]
    : undefined;

  const notifications = await prisma.notification.findMany({
    where: {
      category: categoryFilter,
      read: stateFilter === "" ? undefined : stateFilter === "read",
      OR: textFilters,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      message: true,
      category: true,
      entityType: true,
      entityId: true,
      read: true,
      createdAt: true,
    },
  });

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-strong)]">Notifications</h1>
        <p className="text-sm text-[var(--text-muted)]">Real-time alerts across orders, drivers, customers, and payments.</p>
      </header>

      <form className="flex flex-col gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)]/80 px-5 py-6 sm:flex-row sm:items-end">
        <label className="flex min-w-[220px] flex-1 flex-col gap-2 text-sm">
          <span className="font-medium text-[var(--text-strong)]">Search</span>
          <input
            type="search"
            name="q"
            defaultValue={queryRaw}
            placeholder="Search titles or descriptions"
            className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-[var(--text-strong)]">Category</span>
          <select
            name="category"
            defaultValue={categoryFilter ?? ""}
            className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
          >
            <option value="">All</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-[var(--text-strong)]">State</span>
          <select
            name="state"
            defaultValue={stateFilter}
            className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
          >
            <option value="">All</option>
            <option value="unread">Unread only</option>
            <option value="read">Read only</option>
          </select>
        </label>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)]"
        >
          Apply filters
        </button>
        <Link
          href="/admin/notifications"
          className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-5 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
        >
          Reset
        </Link>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--text-muted)]">
        <span>
          Showing <strong className="text-[var(--text-strong)]">{notifications.length}</strong> notifications
          {unreadCount > 0 ? ` · ${unreadCount} unread` : ""}
        </span>
        {unreadCount > 0 ? (
          <form action={markAllNotificationsRead}>
            <input type="hidden" name="category" value={categoryFilter ?? ""} />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
            >
              Mark all as read
            </button>
          </form>
        ) : null}
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface)]/60 p-10 text-center text-sm text-[var(--text-muted)]">
          No notifications found. Adjust your filters or wait for new activity.
        </div>
      ) : (
        <ul className="space-y-3">
          {notifications.map((notification: NotificationRecord) => {
            const categoryLabel = CATEGORY_LABELS[notification.category];
            const elapsed = formatDistanceToNow(notification.createdAt, { addSuffix: true });

            return (
              <li
                key={notification.id}
                className={`rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-5 py-4 shadow-sm transition ${
                  notification.read ? "opacity-80" : "shadow-md"
                }`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      <span className="inline-flex items-center rounded-full bg-[var(--brand-accent)]/30 px-3 py-1 font-semibold text-[var(--brand-primary)]">
                        {categoryLabel}
                      </span>
                      {!notification.read ? (
                        <span className="inline-flex items-center rounded-full bg-[var(--brand-primary)]/15 px-3 py-1 font-semibold text-[var(--brand-primary)]">
                          Unread
                        </span>
                      ) : null}
                      <span>{elapsed}</span>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-[var(--text-strong)]">{notification.title}</h3>
                      <p className="text-sm text-[var(--text-muted)]">{notification.message}</p>
                    </div>
                  </div>
                  <form
                    action={toggleNotificationRead}
                    className="flex shrink-0 items-center justify-end gap-2"
                  >
                    <input type="hidden" name="id" value={notification.id} />
                    <input type="hidden" name="read" value={notification.read ? "false" : "true"} />
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                    >
                      {notification.read ? "Mark unread" : "Mark read"}
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
