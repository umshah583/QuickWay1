import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function parseParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

async function fetchDrivers() {
  return prisma.user.findMany({
    where: { role: "DRIVER" },
    orderBy: { name: "asc" },
    include: {
      DriverDay: {
        where: {
          date: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
        include: {
          DriverBreak: {
            orderBy: { startedAt: 'desc' },
          },
        },
        orderBy: { date: 'desc' },
        take: 1,
      },
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
function deriveAvailability(driver: any) {
  // Check if driver is currently on break
  const activeDay = driver.DriverDay?.[0];
  const activeBreak = activeDay?.DriverBreak?.find((break_: any) => !break_.endedAt);
  if (activeBreak) {
    return { 
      label: "On Break", 
      tone: "bg-amber-500/15 text-amber-400",
      breakInfo: {
        reason: activeBreak.reasonDisplay,
        startedAt: activeBreak.startedAt,
      }
    };
  }

  // Check if driver has an active day
  if (!activeDay || activeDay.status !== 'OPEN') {
    return { 
      label: "Off Duty", 
      tone: "bg-gray-500/15 text-gray-400" 
    };
  }

  // Driver is available
  return { 
    label: "Available", 
    tone: "bg-emerald-500/15 text-emerald-400" 
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
function deriveVehicle(_driver: any) {
  // Since we don't have driverBookings relation, return not provided
  return "Not provided";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
function deriveRating(_driver: any) {
  // Since we don't have driverBookings relation, return default rating
  return 0;
}

export default async function AdminDriversPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const queryRaw = parseParam(params.q);
  const query = queryRaw.trim().toLowerCase();
  const createdFlag = parseParam(params.created) === "1";

  const allDrivers = await fetchDrivers();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drivers = allDrivers.filter((driver: any) => {
    if (!query) return true;
    const haystack = [driver.name, driver.email].join(" ").toLowerCase();
    return haystack.includes(query);
  });

  const totalDrivers = drivers.length;
  const activeDrivers = drivers.filter((driver: any) => 
    driver.DriverDay?.some((day: any) => day.status === 'OPEN')
  ).length;
  const driversOnBreak = drivers.filter((driver: any) => 
    driver.DriverDay?.some((day: any) => 
      day.DriverBreak?.some((break_: any) => !break_.endedAt)
    )
  ).length;
  const completedOrders = 0; // Since we don't have driverBookings relation

  return (
    <div className="space-y-8">
      {createdFlag ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          New driver added successfully.
        </div>
      ) : null}
      <header className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-strong)]">Driver performance</h1>
            <p className="text-sm text-[var(--text-muted)]">Monitor availability, productivity, and ratings for each driver.</p>
          </div>
          <div className="flex flex-col gap-3 text-xs text-[var(--text-muted)] sm:flex-row sm:items-center sm:gap-4">
            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:justify-end">
              <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-1">
                Drivers <strong className="ml-1 text-[var(--text-strong)]">{totalDrivers}</strong>
              </span>
              <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-1">
                On duty <strong className="ml-1 text-[var(--text-strong)]">{activeDrivers}</strong>
              </span>
              <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-1">
                On break <strong className="ml-1 text-[var(--text-strong)]">{driversOnBreak}</strong>
              </span>
              <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-1">
                Completed jobs <strong className="ml-1 text-[var(--text-strong)]">{completedOrders}</strong>
              </span>
            </div>
            <Link
              href="/admin/drivers/new"
              className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)]"
            >
              Add driver
            </Link>
          </div>
        </div>

        <form method="get" className="flex flex-col gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)]/80 px-5 py-6 sm:flex-row sm:items-end">
          <label className="flex min-w-[260px] flex-1 flex-col gap-2 text-sm">
            <span className="font-medium text-[var(--text-strong)]">Search drivers</span>
            <input
              type="search"
              name="q"
              defaultValue={queryRaw}
              placeholder="Search by name, email, or booking ID"
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
            href="/admin/drivers"
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
              <th className="px-4 py-3">Driver</th>
              <th className="px-4 py-3">Availability</th>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">Jobs</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3">Last activity</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((driver) => {
              const availability = deriveAvailability(driver);
              const vehicle = deriveVehicle(driver);
              const rating = deriveRating(driver);
              const completed = 0; // Since we don't have driverBookings relation
              const active = 0; // Since we don't have driverBookings relation
              const lastOrder = null; // Since we don't have driverBookings relation

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
                    {availability.breakInfo && (
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {availability.breakInfo.reason} since {formatDistanceToNow(new Date(availability.breakInfo.startedAt), { addSuffix: true })}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-[var(--text-muted)]">Active jobs: {active}</p>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{vehicle}</td>
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
    </div>
  );
}
