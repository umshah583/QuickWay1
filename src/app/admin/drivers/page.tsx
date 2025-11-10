import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type DriverRecord = Awaited<ReturnType<typeof fetchDrivers>>[number];

type SearchParams = Record<string, string | string[] | undefined>;

function parseParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
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

function deriveAvailability(driver: DriverRecord) {
  const active = driver.driverBookings.find((booking) => booking.taskStatus !== "COMPLETED");
  if (active) {
    return { label: "On job", tone: "bg-amber-500/15 text-amber-400" };
  }
  return { label: "Available", tone: "bg-emerald-500/15 text-emerald-400" };
}

function deriveVehicle(driver: DriverRecord) {
  const latest = driver.driverBookings[0];
  if (!latest?.service?.name) {
    return "Not provided";
  }
  const serviceName = latest.service.name.toLowerCase();
  if (serviceName.includes("suv")) return "SUV";
  if (serviceName.includes("pickup")) return "Pickup";
  if (serviceName.includes("bike")) return "Bike";
  if (serviceName.includes("interior")) return "Interior crew";
  return "Sedan";
}

function deriveRating(driver: DriverRecord) {
  const completed = driver.driverBookings.filter((b) => b.taskStatus === "COMPLETED").length;
  if (completed === 0) return 4.0;
  const onTime = driver.driverBookings.filter((b) => b.status === "PAID").length;
  const score = 3.8 + Math.min(onTime / Math.max(completed, 1), 1) * 1.2;
  return Math.min(5, Number(score.toFixed(1)));
}

export default async function AdminDriversPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const queryRaw = parseParam(params.q);
  const query = queryRaw.trim().toLowerCase();
  const createdFlag = parseParam(params.created) === "1";

  const allDrivers = await fetchDrivers();

  const drivers = allDrivers.filter((driver) => {
    if (!query) return true;
    const haystack = [driver.name, driver.email, ...driver.driverBookings.map((b) => b.id)].join(" ").toLowerCase();
    return haystack.includes(query);
  });

  const totalDrivers = drivers.length;
  const activeDrivers = drivers.filter((driver) => driver.driverBookings.some((b) => b.taskStatus !== "COMPLETED"));
  const completedOrders = drivers.reduce((sum, driver) => sum + driver.driverBookings.filter((b) => b.taskStatus === "COMPLETED").length, 0);

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
                On duty <strong className="ml-1 text-[var(--text-strong)]">{activeDrivers.length}</strong>
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
              const completed = driver.driverBookings.filter((b) => b.taskStatus === "COMPLETED").length;
              const active = driver.driverBookings.filter((b) => b.taskStatus !== "COMPLETED").length;
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
