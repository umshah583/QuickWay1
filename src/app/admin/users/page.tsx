import Link from "next/link";
import { prisma } from "@/lib/prisma";
import UsersManagementClient from "./UsersManagementClient";

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
      Booking_Booking_userIdToUser: {
        include: {
          Service: true,
          Payment: true,
          User_Booking_driverIdToUser: { select: { name: true, email: true } },
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
      Booking_Booking_driverIdToUser: {
        include: {
          Service: true,
          User_Booking_userIdToUser: { select: { name: true, email: true } },
          Payment: true,
        },
        orderBy: { startAt: "desc" },
      },
    },
  });
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
    const haystack = [customer.name, customer.email, ...customer.Booking_Booking_userIdToUser.map((b) => b.id)].join(" ").toLowerCase();
    return haystack.includes(customerQueryRaw.trim().toLowerCase());
  });

  const drivers = allDrivers.filter((driver) => {
    if (!driverQueryRaw) return true;
    const haystack = [driver.name, driver.email, ...driver.Booking_Booking_driverIdToUser.map((b) => b.id)].join(" ").toLowerCase();
    return haystack.includes(driverQueryRaw.trim().toLowerCase());
  });

  const engagedCustomers = customers.filter((customer) => {
    const latest = customer.Booking_Booking_userIdToUser[0]?.startAt;
    return latest ? (Date.now() - latest.getTime()) / 86_400_000 <= 60 : false;
  }).length;

  const totalValueCents = customers.reduce((sum, customer) => {
    const value = customer.Booking_Booking_userIdToUser.reduce((acc, booking) => {
      const payment = booking.Payment?.amountCents ?? 0;
      const cash = booking.cashCollected ? booking.cashAmountCents ?? booking.Service?.priceCents ?? 0 : 0;
      return acc + payment + cash;
    }, 0);
    return sum + value;
  }, 0);

  const activeDrivers = drivers.filter((driver) => driver.Booking_Booking_driverIdToUser.some((b) => b.taskStatus !== "COMPLETED"));
  const completedOrders = drivers.reduce((sum, driver) => sum + driver.Booking_Booking_driverIdToUser.filter((b) => b.taskStatus === "COMPLETED").length, 0);

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

          <UsersManagementClient 
            customers={customers} 
            drivers={drivers} 
            activeTab={activeTab} 
          />
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

          <UsersManagementClient 
            customers={customers} 
            drivers={drivers} 
            activeTab={activeTab} 
          />
        </section>
      )}
    </div>
  );
}
