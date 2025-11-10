import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

function loyaltyPoints(lifetimeValueCents: number) {
  return Math.floor(lifetimeValueCents / 10_000);
}

async function fetchCustomers() {
  return prisma.user.findMany({
    where: { role: "USER" },
    orderBy: { createdAt: "desc" },
    include: {
      bookings: {
        include: {
          service: true,
          payment: true,
          driver: { select: { name: true, email: true } },
        },
        orderBy: { startAt: "desc" },
      },
    },
  });
}

function computeStatus(latestBooking?: Date) {
  if (!latestBooking) {
    return { label: "New", tone: "bg-sky-500/15 text-sky-400" };
  }
  const days = (Date.now() - latestBooking.getTime()) / 86_400_000;
  if (days <= 30) {
    return { label: "Active", tone: "bg-emerald-500/15 text-emerald-400" };
  }
  if (days <= 90) {
    return { label: "Warm", tone: "bg-amber-500/15 text-amber-400" };
  }
  return { label: "Dormant", tone: "bg-rose-500/15 text-rose-400" };
}

export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const queryRaw = typeof params.q === "string" ? params.q : Array.isArray(params.q) ? params.q[0] ?? "" : "";
  const query = queryRaw.trim().toLowerCase();

  const allCustomers = await fetchCustomers();

  const customers = allCustomers.filter((customer) => {
    if (!query) return true;
    const haystack = [customer.name, customer.email, ...customer.bookings.map((b) => b.id)].join(" ").toLowerCase();
    return haystack.includes(query);
  });

  const totalCustomers = customers.length;
  const engagedCustomers = customers.filter((customer) => {
    const latest = customer.bookings[0]?.startAt;
    return latest ? (Date.now() - latest.getTime()) / 86_400_000 <= 60 : false;
  }).length;
  const totalValueCents = customers.reduce((sum, customer) => {
    const value = customer.bookings.reduce((acc, booking) => {
      const payment = booking.payment?.amountCents ?? 0;
      const cash = booking.cashCollected ? booking.cashAmountCents ?? booking.service?.priceCents ?? 0 : 0;
      return acc + payment + cash;
    }, 0);
    return sum + value;
  }, 0);

  if (customers.length === 0) {
    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Customers</h1>
          <p className="text-sm text-[var(--text-muted)]">No customers match your filters. Clear search to see everyone.</p>
        </header>
        <div className="rounded-xl border border-dashed border-[var(--surface-border)] bg-[var(--surface)]/60 p-8 text-center text-sm text-[var(--text-muted)]">
          Encourage bookings to build your customer base and loyalty programme.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-strong)]">Customer intelligence</h1>
            <p className="text-sm text-[var(--text-muted)]">Track loyalty, spending, and engagement to nurture your best customers.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs text-[var(--text-muted)] sm:flex sm:flex-wrap sm:justify-end">
            <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-1">
              Customers <strong className="ml-1 text-[var(--text-strong)]">{totalCustomers}</strong>
            </span>
            <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-1">
              Engaged <strong className="ml-1 text-[var(--text-strong)]">{engagedCustomers}</strong>
            </span>
            <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-1">
              Lifetime value <strong className="ml-1 text-[var(--text-strong)]">{formatCurrency(totalValueCents)}</strong>
            </span>
          </div>
        </div>

        <form method="get" className="flex flex-col gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)]/80 px-5 py-6 sm:flex-row sm:items-end">
          <label className="flex min-w-[260px] flex-1 flex-col gap-2 text-sm">
            <span className="font-medium text-[var(--text-strong)]">Search customers</span>
            <input
              type="search"
              name="q"
              defaultValue={queryRaw}
              placeholder="Search by name, email, or order ID"
              className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)]"
          >
            Apply search
          </button>
          <Link
            href="/admin/customers"
            className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-5 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
          >
            Reset
          </Link>
        </form>
      </header>

      <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
            <tr className="uppercase tracking-[0.16em] text-xs">
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Last engaged</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Loyalty</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Lifetime value</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => {
              const bookings = customer.bookings;
              const lastBooking = bookings[0]?.startAt;
              const orderCount = bookings.length;
              const lifetimeValueCents = bookings.reduce((sum, booking) => {
                const payment = booking.payment?.amountCents ?? 0;
                const cash = booking.cashCollected ? booking.cashAmountCents ?? booking.service?.priceCents ?? 0 : 0;
                return sum + payment + cash;
              }, 0);
              const points = loyaltyPoints(lifetimeValueCents);
              const status = computeStatus(lastBooking);

              return (
                <tr key={customer.id} className="border-t border-[var(--surface-border)]">
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <p className="font-semibold text-[var(--text-strong)]">{customer.name ?? customer.email ?? "Customer"}</p>
                      <p className="text-xs text-[var(--text-muted)]">{customer.email ?? "No email on file"}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    {lastBooking ? formatDistanceToNow(lastBooking, { addSuffix: true }) : "No orders yet"}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{orderCount}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    <span className="inline-flex min-w-[3.5rem] items-center justify-center rounded-full bg-[var(--brand-accent)]/30 px-3 py-1 text-xs font-semibold text-[var(--brand-primary)]">
                      {points} pts
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${status.tone}`}>{status.label}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-[var(--text-strong)]">{formatCurrency(lifetimeValueCents)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/customers/${customer.id}`}
                      className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                    >
                      View profile
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
