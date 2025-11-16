import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import stripe from "@/lib/stripe";
import PayButton from "../components/PayButton";
import PushNotificationsSection from "./PushNotificationsSection";

type AccountSearchParams = {
  paid?: string;
  session_id?: string;
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

function formatBookingStatus(
  status: string,
  taskStatus: string | null | undefined,
  driverName: string | null,
): string {
  if (status === "CANCELLED") {
    return "Cancelled";
  }

  if (taskStatus === "COMPLETED") {
    return "Completed";
  }

  if (taskStatus === "IN_PROGRESS") {
    return "In progress";
  }

  if (driverName) {
    return "Driver assigned";
  }

  return "Pending";
}

function formatPaymentStatus(status?: string | null, cashCollected?: boolean | null) {
  if (cashCollected) {
    return "Paid (cash)";
  }

  switch (status) {
    case "PAID":
      return "Paid";
    case "REFUNDED":
      return "Refunded";
    case "CANCELED":
      return "Canceled";
    case "REQUIRES_PAYMENT":
    default:
      return "Awaiting payment";
  }
}

async function syncCheckoutSession(sessionId: string, userId: string) {
  if (!stripe) {
    return;
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    if (!session) {
      return;
    }

    if (session.payment_status !== "paid" && session.status !== "complete") {
      return;
    }

    const bookingId = session.metadata?.bookingId as string | undefined;
    const paymentId = session.metadata?.paymentId as string | undefined;

    if (!bookingId) {
      return;
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { userId: true },
    });

    if (!booking || booking.userId !== userId) {
      return;
    }

    const updates: [Promise<unknown>, Promise<unknown>?] = [
      prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: "PAID",
          cashCollected: false,
          cashSettled: true,
          cashAmountCents: null,
        },
      }),
      undefined,
    ];

    if (paymentId) {
      updates[1] = prisma.payment.update({ where: { id: paymentId }, data: { status: "PAID" } });
    } else {
      updates[1] = prisma.payment.updateMany({ where: { bookingId }, data: { status: "PAID" } });
    }

    await Promise.all(updates.filter(Boolean) as Promise<unknown>[]);
  } catch (error) {
    console.error("Stripe checkout sync failed", error);
  }
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<AccountSearchParams>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/sign-in?callbackUrl=/account");
  const userId = (session.user as { id: string }).id;

  const resolvedSearchParams = await searchParams;
  const checkoutSessionId = resolvedSearchParams?.session_id;

  if (checkoutSessionId) {
    await syncCheckoutSession(checkoutSessionId, userId);
  }

  const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    timeStyle: "short",
  });

  type BookingItem = {
    id: string;
    startAt: Date;
    endAt: Date;
    status: string;
    taskStatus: string;
    service: { id: string; name: string; priceCents: number };
    payment: { id: string; status: string } | null;
    driver: { name: string | null; email: string | null } | null;
    cashCollected: boolean;
  };

  const bookings: BookingItem[] = await prisma.booking.findMany({
    where: { userId },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      status: true,
      taskStatus: true,
      service: { select: { id: true, name: true, priceCents: true } },
      payment: { select: { id: true, status: true } },
      driver: { select: { name: true, email: true } },
      cashCollected: true,
    },
    orderBy: { startAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold mb-6">My Bookings</h1>
      <PushNotificationsSection />
      <div className="space-y-4">
        {bookings.length === 0 && <p className="text-zinc-600">No bookings yet.</p>}
        {bookings.map((b: BookingItem) => {
          const driverName = b.driver?.name || b.driver?.email || null;
          const bookingStatusLabel = formatBookingStatus(b.status, b.taskStatus, driverName);
          const paymentStatusLabel = formatPaymentStatus(b.payment?.status, b.cashCollected);
          const startLabel = dateTimeFormatter.format(b.startAt);
          const endLabel = timeFormatter.format(b.endAt);
          const isCancelled = b.status === "CANCELLED";
          return (
            <div
              key={b.id}
              className={`border rounded p-4 transition ${isCancelled ? "border-dashed border-zinc-200 bg-zinc-100/60 text-zinc-500" : "bg-white"}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className={`font-medium text-lg ${isCancelled ? "text-zinc-500" : "text-zinc-900"}`}>{b.service.name}</p>
                  <p className={`text-sm ${isCancelled ? "text-zinc-500" : "text-zinc-600"}`}>
                    <time dateTime={b.startAt.toISOString()} suppressHydrationWarning>
                      {startLabel}
                    </time>{" "}
                    —{" "}
                    <time dateTime={b.endAt.toISOString()} suppressHydrationWarning>
                      {endLabel}
                    </time>
                  </p>
                  <div className="mt-3 text-xs uppercase tracking-[0.2em] text-zinc-400">Status</div>
                  <p className="text-sm font-semibold text-zinc-800">
                    {bookingStatusLabel}
                    {isCancelled ? null : (
                      <span className="ml-2 text-xs font-medium text-zinc-500">Payment: {paymentStatusLabel}</span>
                    )}
                  </p>
                </div>
                <div className="text-right space-y-2">
                  <p className={`font-semibold ${isCancelled ? "text-zinc-500" : "text-zinc-900"}`}>{formatCurrency(b.service.priceCents)}</p>
                  {b.status === "PENDING" ? (
                    <PayButton bookingId={b.id} />
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
