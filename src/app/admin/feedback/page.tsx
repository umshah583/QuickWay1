import { formatDistanceToNow, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { deleteFeedback } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage() {
  const now = new Date();
  const cutoff = subDays(now, 2);

  const feedbackItems = await prisma.feedback.findMany({
    where: {
      OR: [
        { read: false },
        { read: true, readAt: { gte: cutoff } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      booking: {
        select: {
          startAt: true,
          service: { select: { name: true } },
          driver: { select: { name: true } },
        },
      },
    },
  });

  const unreadIds = feedbackItems.filter((f) => !f.read).map((f) => f.id);
  if (unreadIds.length) {
    await prisma.feedback.updateMany({
      where: { id: { in: unreadIds } },
      data: { read: true, readAt: now },
    });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Customer feedback</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Recent feedback from the mobile app. Comments remain visible for two days after they are read; ratings stay stored
          permanently for driver performance.
        </p>
      </header>

      {feedbackItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--surface-border)] bg-[var(--surface)]/60 p-6 text-sm text-[var(--text-muted)]">
          No feedback yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] shadow-sm">
          <table className="min-w-full divide-y divide-[var(--surface-border)] text-sm">
            <thead className="bg-[var(--background)]/60">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Received
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Service / Driver
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Rating
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Comment
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)] bg-[var(--surface)]/80">
              {feedbackItems.map((item) => {
                const customerName = item.user?.name || item.user?.email || "Customer";
                const serviceName = item.booking?.service?.name || "Service";
                const driverName = item.booking?.driver?.name || "Unassigned";
                const receivedAgo = formatDistanceToNow(item.createdAt, { addSuffix: true });

                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3 align-top text-xs text-[var(--text-muted)]">
                      <div>{receivedAgo}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-semibold text-[var(--text-strong)]">{customerName}</div>
                      <div className="text-xs text-[var(--text-muted)]">Booking ID: {item.bookingId}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-semibold text-[var(--text-strong)]">{serviceName}</div>
                      <div className="text-xs text-[var(--text-muted)]">Driver: {driverName}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {typeof item.rating === "number" ? (
                        <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600">
                          {item.rating} / 5
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">No rating</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-[var(--text-medium)]">
                      {item.message}
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <form action={deleteFeedback} method="post">
                        <input type="hidden" name="id" value={item.id} />
                        <button
                          type="submit"
                          className="inline-flex items-center rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
