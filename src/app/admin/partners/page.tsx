import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import DeletePartnerForm from "./DeletePartnerForm";

export const dynamic = "force-dynamic";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

const partnerInclude = {
  drivers: {
    include: {
      driverBookings: {
        select: {
          id: true,
          taskStatus: true,
          status: true,
          cashCollected: true,
          cashAmountCents: true,
          service: { select: { priceCents: true } },
        },
      },
    },
  },
  bookings: {
    select: {
      id: true,
      taskStatus: true,
      status: true,
      cashCollected: true,
      cashAmountCents: true,
      createdAt: true,
      service: { select: { priceCents: true } },
      payment: { select: { status: true, amountCents: true } },
    },
  },
} satisfies Prisma.PartnerInclude;

type PartnerRecord = Prisma.PartnerGetPayload<{ include: typeof partnerInclude }>;
type PartnerDriver = PartnerRecord["drivers"][number];
type PartnerDriverBooking = PartnerDriver["driverBookings"][number];
type PartnerBooking = PartnerRecord["bookings"][number];

async function loadPartners(): Promise<PartnerRecord[]> {
  return prisma.partner.findMany({
    orderBy: { name: "asc" },
    include: partnerInclude,
  });
}

type SearchParams = Record<string, string | string[] | undefined>;

function parseParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function computeEarnings(partner: PartnerRecord) {
  return partner.bookings.reduce((sum: number, booking: PartnerBooking) => {
    if (booking.payment?.status === "PAID") {
      return sum + (booking.payment.amountCents ?? booking.service?.priceCents ?? 0);
    }
    if (booking.cashCollected) {
      return sum + (booking.cashAmountCents ?? booking.service?.priceCents ?? 0);
    }
    return sum;
  }, 0);
}

export default async function AdminPartnersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const queryRaw = parseParam(params.q);
  const query = queryRaw.trim().toLowerCase();
  const createdFlag = parseParam(params.created) === "1";
  const updatedFlag = parseParam(params.updated) === "1";
  const deletedFlag = parseParam(params.deleted) === "1";

  const partners = await loadPartners();

  const filtered = partners.filter((partner) => {
    if (!query) return true;
    const haystack = [partner.name, partner.email, ...partner.drivers.map((driver) => driver.name ?? driver.email ?? "")]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });

  type PartnerAggregates = {
    totalPartners: number;
    totalDrivers: number;
    totalActiveDrivers: number;
    totalActiveJobs: number;
    totalEarnings: number;
  };

  const aggregates = filtered.reduce(
    (acc: PartnerAggregates, partner) => {
      const earnings = computeEarnings(partner);
      const drivers = partner.drivers.length;
      const activeDrivers = partner.drivers.filter((driver: PartnerDriver) =>
        driver.driverBookings.some((booking: PartnerDriverBooking) => booking.taskStatus !== "COMPLETED"),
      ).length;
      const activeJobs = partner.bookings.filter((booking: PartnerBooking) => booking.taskStatus !== "COMPLETED").length;

      acc.totalPartners += 1;
      acc.totalDrivers += drivers;
      acc.totalActiveDrivers += activeDrivers;
      acc.totalActiveJobs += activeJobs;
      acc.totalEarnings += earnings;
      return acc;
    },
    { totalPartners: 0, totalDrivers: 0, totalActiveDrivers: 0, totalActiveJobs: 0, totalEarnings: 0 } as PartnerAggregates,
  );

  return (
    <div className="space-y-10">
      <header className="space-y-6">
        {createdFlag || updatedFlag || deletedFlag ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
            {createdFlag ? "Partner added successfully." : null}
            {updatedFlag ? " Partner updated." : null}
            {deletedFlag ? " Partner removed." : null}
          </div>
        ) : null}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-strong)]">Partner performance</h1>
            <p className="max-w-xl text-sm text-[var(--text-muted)]">Monitor third-party partner activity, revenue contribution, and driver coverage.</p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-end">
            <form method="get" className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-5">
              <label className="flex min-w-[260px] flex-1 flex-col gap-2">
                <span className="text-sm font-medium text-[var(--text-strong)]">Search partners</span>
                <input
                  type="search"
                  name="q"
                  defaultValue={queryRaw}
                  placeholder="Search by partner or driver name"
                  className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                />
              </label>
              <div className="flex items-center gap-3">
                <button type="submit" className="btn btn-primary px-6 py-2.5 min-w-[9rem]">
                  Apply search
                </button>
                <Link href="/admin/partners" className="btn btn-muted px-6 py-2.5 min-w-[9rem]">
                  Reset
                </Link>
              </div>
            </form>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
            <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Partners</h2>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{aggregates.totalPartners}</p>
          </article>
          <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
            <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Drivers</h2>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{aggregates.totalDrivers}</p>
            <p className="text-xs text-[var(--text-muted)]">{aggregates.totalActiveDrivers} currently on duty</p>
          </article>
          <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
            <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Active jobs</h2>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{aggregates.totalActiveJobs}</p>
          </article>
          <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
            <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Total earnings</h2>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(aggregates.totalEarnings)}</p>
          </article>
        </div>

        <div className="flex justify-end">
          <Link href="/admin/partners/new" className="btn btn-primary px-6 py-2.5 min-w-[9rem]">
            Add partner
          </Link>
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-white">
        <table className="w-full text-left text-[0.6rem] leading-tight">
          <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
            <tr className="text-[0.52rem] uppercase tracking-[0.22em]">
              <th className="px-2.5 py-2">Partner</th>
              <th className="px-2.5 py-2">Drivers</th>
              <th className="px-2.5 py-2">On duty</th>
              <th className="px-2.5 py-2">Active jobs</th>
              <th className="px-2.5 py-2">Total earnings</th>
              <th className="px-2.5 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((partner: PartnerRecord) => {
              const driverCount = partner.drivers.length;
              const onDutyDrivers = partner.drivers.filter((driver: PartnerDriver) =>
                driver.driverBookings.some((booking: PartnerDriverBooking) => booking.taskStatus !== "COMPLETED"),
              ).length;
              const activeJobs = partner.bookings.filter((booking: PartnerBooking) => booking.taskStatus !== "COMPLETED").length;
              const earnings = computeEarnings(partner);

              return (
                <tr key={partner.id} className="border-t border-[var(--surface-border)]">
                  <td className="px-2.5 py-2">
                    <div className="space-y-1">
                      <p className="text-[0.72rem] font-semibold text-[var(--text-strong)]">{partner.name}</p>
                      <p className="text-[0.55rem] text-[var(--text-muted)]">{partner.email ?? "No email on file"}</p>
                    </div>
                  </td>
                  <td className="px-2.5 py-2 text-[0.72rem] font-semibold text-[var(--text-strong)]">{driverCount}</td>
                  <td className="px-2.5 py-2 text-[0.72rem] font-semibold text-[var(--text-strong)]">{onDutyDrivers}</td>
                  <td className="px-2.5 py-2 text-[0.72rem] text-[var(--text-strong)]">{activeJobs}</td>
                  <td className="px-2.5 py-2 text-[0.72rem] text-[var(--text-strong)]">{formatCurrency(earnings)}</td>
                  <td className="px-2.5 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/partners/${partner.id}`}
                        className="btn btn-muted btn-xs px-4 py-1.5 min-w-[8.5rem]"
                      >
                        View dashboard
                      </Link>
                      <Link
                        href={`/admin/partners/${partner.id}/edit`}
                        className="btn btn-muted btn-xs px-4 py-1.5 min-w-[5.5rem]"
                      >
                        Edit
                      </Link>
                      <DeletePartnerForm partnerId={partner.id} partnerName={partner.name} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-[var(--text-muted)]">No partners match your filters yet.</div>
        ) : null}
      </div>
    </div>
  );
}
