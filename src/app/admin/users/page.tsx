import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

function parseParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
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

async function fetchDrivers() {
  return prisma.user.findMany({
    where: { role: "DRIVER" },
    orderBy: { name: "asc" },
    include: {
      driverBookings: {
        include: {
          service: true,
          user: { select: { name: true, email: true } },
          payment: true,
        },
        orderBy: { startAt: "desc" },
      },
    },
  });
}

function computeCustomerStatus(latestBooking?: Date) {
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

function deriveDriverAvailability(driver: Awaited<ReturnType<typeof fetchDrivers>>[number]) {
  const active = driver.driverBookings.find((booking) => booking.taskStatus !== "COMPLETED");
  if (active) {
    return { label: "On job", tone: "bg-amber-500/15 text-amber-400" };
  }
  return { label: "Available", tone: "bg-emerald-500/15 text-emerald-400" };
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const customerQueryRaw = parseParam(params.customerQ);
  const driverQueryRaw = parseParam(params.driverQ);
  const requestedView = parseParam(params.view)?.toLowerCase();
  const activeTab: "customers" | "drivers" = requestedView === "drivers" ? "drivers" : "customers";

  const [allCustomers, allDrivers] = await Promise.all([fetchCustomers(), fetchDrivers()]);

  const customers = allCustomers.filter((customer) => {
    if (!customerQueryRaw) return true;
    const haystack = [customer.name, customer.email, ...customer.bookings.map((b) => b.id)].join(" ").toLowerCase();
    return haystack.includes(customerQueryRaw.trim().toLowerCase());
  });

  const drivers = allDrivers.filter((driver) => {
    if (!driverQueryRaw) return true;
    const haystack = [driver.name, driver.email, ...driver.driverBookings.map((b) => b.id)].join(" ").toLowerCase();
    return haystack.includes(driverQueryRaw.trim().toLowerCase());
  });

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

  const activeDrivers = drivers.filter((driver) => driver.driverBookings.some((b) => b.taskStatus !== "COMPLETED"));
  const completedOrders = drivers.reduce((sum, driver) => sum + driver.driverBookings.filter((b) => b.taskStatus === "COMPLETED").length, 0);

  const buildTabHref = (tab: "customers" | "drivers") => {
    const params = new URLSearchParams();
    params.set("view", tab);
    if (tab === "customers" && customerQueryRaw) params.set("customerQ", customerQueryRaw);
    if (tab === "drivers" && driverQueryRaw) params.set("driverQ", driverQueryRaw);
    return `/admin/users?${params.toString()}`;
  };

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-strong)]">Users</h1>
        <p className="text-sm text-[var(--text-muted)]">Manage customer loyalty insights and driver productivity from a single view.</p>
      </header>

      <div className="flex flex-wrap gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-5 py-4 text-sm font-semibold">
        <Link
          href={buildTabHref("customers")}
          className={`rounded-full px-5 py-2 transition ${
            activeTab === "customers"
              ? "bg-[var(--brand-primary)] text-white shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
          }`}
        >
          Customers
        </Link>
        <Link
          href={buildTabHref("drivers")}
          className={`rounded-full px-5 py-2 transition ${
            activeTab === "drivers"
              ? "bg-[var(--brand-primary)] text-white shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
          }`}
        >
          Drivers
        </Link>
      </div>

      {activeTab === "customers" ? (
        <section className="space-y-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-7 shadow-sm">
          <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold text-[var(--text-strong)]">Customers</h2>
              <p className="text-sm text-[var(--text-muted)]">Track loyalty, lifetime value, and engagement.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-[var(--text-muted)] sm:flex sm:flex-wrap sm:justify-end">
              <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-1">
                Customers <strong className="ml-1 text-[var(--text-strong)]">{customers.length}</strong>
              </span>
              <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-1">
                Engaged <strong className="ml-1 text-[var(--text-strong)]">{engagedCustomers}</strong>
              </span>
              <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-1">
                Lifetime value <strong className="ml-1 text-[var(--text-strong)]">{formatCurrency(totalValueCents)}</strong>
              </span>
            </div>
          </header>

          <form method="get" className="flex flex-col gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)]/80 px-5 py-6 sm:flex-row sm:items-end">
            <input type="hidden" name="view" value="customers" />
            <label className="flex min-w-[240px] flex-1 flex-col gap-2 text-sm">
              <span className="font-medium text-[var(--text-strong)]">Search customers</span>
              <input
                type="search"
                name="customerQ"
                defaultValue={customerQueryRaw}
                placeholder="Search by name, email, or booking ID"
                className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)]"
              >
                Apply search
              </button>
              <Link
                href="/admin/users?view=customers"
                className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-5 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
              >
                Reset
              </Link>
            </div>
          </form>

          <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
                <tr className="uppercase tracking-[0.16em] text-xs">
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Last engaged</th>
                  <th className="px-4 py-3">Orders</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Lifetime value</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.slice(0, 15).map((customer) => {
                  const bookings = customer.bookings;
                  const lastBooking = bookings[0]?.startAt;
                  const orderCount = bookings.length;
                  const lifetimeValueCents = bookings.reduce((sum, booking) => {
                    const payment = booking.payment?.amountCents ?? 0;
                    const cash = booking.cashCollected ? booking.cashAmountCents ?? booking.service?.priceCents ?? 0 : 0;
                    return sum + payment + cash;
                  }, 0);
                  const status = computeCustomerStatus(lastBooking);

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
        </section>
      ) : (
        <section className="space-y-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-7 shadow-sm">
          <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold text-[var(--text-strong)]">Drivers</h2>
              <p className="text-sm text-[var(--text-muted)]">Monitor availability, productivity, and ratings.</p>
            </div>
            <div className="flex flex-col gap-3 text-xs text-[var(--text-muted)] sm:flex-row sm:items-center sm:gap-4">
              <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:justify-end">
                <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-1">
                  Drivers <strong className="ml-1 text-[var(--text-strong)]">{drivers.length}</strong>
                </span>
                <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-1">
                  On duty <strong className="ml-1 text-[var(--text-strong)]">{activeDrivers.length}</strong>
                </span>
                <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-1">
                  Completed jobs <strong className="ml-1 text-[var(--text-strong)]">{completedOrders}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/admin/drivers/new"
                  className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)]"
                >
                  Add driver
                </Link>
              </div>
            </div>
          </header>

          <form method="get" className="flex flex-col gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)]/80 px-5 py-6 sm:flex-row sm:items-end">
            <input type="hidden" name="view" value="drivers" />
            <label className="flex min-w-[240px] flex-1 flex-col gap-2 text-sm">
              <span className="font-medium text-[var(--text-strong)]">Search drivers</span>
              <input
                type="search"
                name="driverQ"
                defaultValue={driverQueryRaw}
                placeholder="Search by name, email, or booking ID"
                className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)]"
              >
                Apply search
              </button>
              <Link
                href="/admin/users?view=drivers"
                className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-5 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
              >
                Reset
              </Link>
            </div>
          </form>

          <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
                <tr className="uppercase tracking-[0.16em] text-xs">
                  <th className="px-4 py-3">Driver</th>
                  <th className="px-4 py-3">Availability</th>
                  <th className="px-4 py-3">Jobs</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3">Last activity</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {drivers.slice(0, 15).map((driver) => {
                  const availability = deriveDriverAvailability(driver);
                  const completed = driver.driverBookings.filter((b) => b.taskStatus === "COMPLETED").length;
                  const activeJobs = driver.driverBookings.filter((b) => b.taskStatus !== "COMPLETED").length;
                  const rating = (() => {
                    if (completed === 0) return 4.0;
                    const onTime = driver.driverBookings.filter((b) => b.status === "PAID").length;
                    const score = 3.8 + Math.min(onTime / Math.max(completed, 1), 1) * 1.2;
                    return Math.min(5, Number(score.toFixed(1)));
                  })();
                  const lastOrder = driver.driverBookings[0]?.startAt;

                  return (
                    <tr key={driver.id} className="border-t border-[var(--surface-border)]">
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <p className="font-semibold text-[var(--text-strong)]">{driver.name ?? driver.email ?? "Driver"}</p>
                          <p className="text-xs text-[var(--text-muted)]">{driver.email ?? "No email on file"}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${availability.tone}`}>{availability.label}</span>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">Active jobs: {activeJobs}</p>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        <span className="font-semibold text-[var(--text-strong)]">{completed}</span> completed
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        <span className="font-semibold text-[var(--text-strong)]">{rating.toFixed(1)}</span>/5
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        {lastOrder ? formatDistanceToNow(lastOrder, { addSuffix: true }) : "No assignments yet"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/drivers/${driver.id}`}
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
        </section>
      )}
    </div>
  );
}
