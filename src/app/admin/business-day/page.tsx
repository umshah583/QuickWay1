import { prisma } from "@/lib/prisma";
import { format, subDays, startOfDay, endOfDay, parseISO } from "date-fns";
import { Clock, Users, TrendingUp, Calendar, BarChart3 } from "lucide-react";
import BusinessHoursForm from "./BusinessHoursForm";
import DateFilter from "./DateFilter";
import Link from "next/link";

export const dynamic = "force-dynamic";

function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function calculateHoursWorked(startedAt: Date, endedAt: Date | null): number {
  const end = endedAt || new Date();
  const diffMs = end.getTime() - new Date(startedAt).getTime();
  return diffMs / (1000 * 60 * 60);
}

type SearchParams = { date?: string };

export default async function BusinessDayPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const today = new Date();
  
  // Parse date from URL or default to today
  const selectedDate = params.date 
    ? parseISO(params.date) 
    : today;
  
  const filterStart = startOfDay(selectedDate);
  const filterEnd = endOfDay(selectedDate);
  
  // Get all driver days for stats (last 30 days)
  const last30Days = startOfDay(subDays(today, 30));
  const allDriverDays = await prisma.driverDay.findMany({
    where: {
      date: { gte: last30Days },
    },
    include: {
      driver: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { startedAt: "desc" },
  });

  // Filter driver days for selected date
  const driverDays = allDriverDays.filter(
    (d) => new Date(d.date) >= filterStart && new Date(d.date) <= filterEnd
  );

  // Calculate statistics for selected date
  const activeDriversToday = driverDays.filter((d) => d.status === "OPEN").length;
  const totalDriversToday = driverDays.length;

  // Calculate total hours and average (from all data for stats)
  const closedShifts = allDriverDays.filter((d) => d.status === "CLOSED" && d.endedAt);
  const totalHoursWorked = closedShifts.reduce((sum, d) => {
    return sum + calculateHoursWorked(d.startedAt, d.endedAt);
  }, 0);
  const averageHoursPerShift = closedShifts.length > 0 ? totalHoursWorked / closedShifts.length : 0;

  // Calculate selected date's total hours (including ongoing shifts)
  const selectedDateTotalHours = driverDays.reduce((sum, d) => {
    return sum + calculateHoursWorked(d.startedAt, d.endedAt);
  }, 0);

  const isToday = format(selectedDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Business Day</h1>
          <p className="text-sm text-[var(--text-muted)]">Manage business hours and track driver activity</p>
        </div>
        <DateFilter currentDate={format(selectedDate, "yyyy-MM-dd")} />
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Drivers Today"
          value={`${activeDriversToday}/${totalDriversToday}`}
          subtitle="Currently on duty"
          icon={<Users className="h-5 w-5 text-emerald-600" />}
          bgColor="bg-emerald-50"
        />
        <StatCard
          title={isToday ? "Today's Total Hours" : "Selected Day Hours"}
          value={formatDuration(selectedDateTotalHours)}
          subtitle="Combined working time"
          icon={<Clock className="h-5 w-5 text-blue-600" />}
          bgColor="bg-blue-50"
        />
        <StatCard
          title="Avg Hours/Shift"
          value={formatDuration(averageHoursPerShift)}
          subtitle="Last 30 days"
          icon={<TrendingUp className="h-5 w-5 text-purple-600" />}
          bgColor="bg-purple-50"
        />
        <StatCard
          title="Total Shifts"
          value={allDriverDays.length.toString()}
          subtitle="Last 30 days"
          icon={<Calendar className="h-5 w-5 text-orange-600" />}
          bgColor="bg-orange-50"
        />
      </div>

      {/* Business Hours Configuration */}
      <BusinessHoursForm />

      {/* Driver Activity Table */}
      <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
        <div className="border-b border-[var(--surface-border)] bg-[var(--surface-secondary)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--text-strong)]">Driver Day Activities</h2>
          <p className="text-sm text-[var(--text-muted)]">Track driver shifts, working hours, and performance</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-[var(--surface-border)] bg-[var(--surface-secondary)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                  Driver
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                  Start Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                  End Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                  Total Hours
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                  Tasks
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                  Performance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {driverDays.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Clock className="mx-auto h-12 w-12 text-[var(--text-muted)]" />
                    <p className="mt-4 text-sm text-[var(--text-muted)]">No driver activity recorded yet</p>
                  </td>
                </tr>
              ) : (
                driverDays.map((day) => {
                  const hoursWorked = calculateHoursWorked(day.startedAt, day.endedAt);
                  return (
                    <tr key={day.id} className="hover:bg-[var(--surface-secondary)]/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-xs font-semibold text-white">
                            {day.driver.name?.charAt(0).toUpperCase() || "D"}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[var(--text-strong)]">
                              {day.driver.name || "Unknown"}
                            </p>
                            <p className="text-xs text-[var(--text-muted)]">{day.driver.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text-medium)]">
                        {format(new Date(day.date), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-[var(--text-medium)]">
                        {format(new Date(day.startedAt), "HH:mm")}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-[var(--text-medium)]">
                        {day.endedAt ? format(new Date(day.endedAt), "HH:mm") : (
                          <span className="text-emerald-600">Ongoing</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-[var(--text-strong)]">
                        {formatDuration(hoursWorked)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <span className="font-medium text-emerald-600">{day.tasksCompleted}</span>
                          <span className="text-[var(--text-muted)]"> completed</span>
                          {day.tasksInProgress > 0 && (
                            <>
                              <span className="text-[var(--text-muted)]"> / </span>
                              <span className="font-medium text-amber-600">{day.tasksInProgress}</span>
                              <span className="text-[var(--text-muted)]"> in progress</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            day.status === "OPEN"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {day.status === "OPEN" ? "On Duty" : "Completed"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/drivers/${day.driver.id}/performance`}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand-primary)] hover:underline"
                        >
                          <BarChart3 className="h-4 w-4" />
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Footer */}
        {driverDays.length > 0 && (
          <div className="border-t border-[var(--surface-border)] bg-[var(--surface-secondary)] px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-[var(--text-muted)]">Total Shifts: </span>
                  <span className="font-semibold text-[var(--text-strong)]">{driverDays.length}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Total Hours: </span>
                  <span className="font-semibold text-[var(--text-strong)]">{formatDuration(totalHoursWorked)}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Average/Shift: </span>
                  <span className="font-semibold text-[var(--text-strong)]">{formatDuration(averageHoursPerShift)}</span>
                </div>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                {isToday ? "Showing today's activity" : `Showing activity for ${format(selectedDate, "MMM d, yyyy")}`}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  bgColor,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  bgColor: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${bgColor}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-semibold text-[var(--text-strong)]">{value}</p>
          <p className="text-sm text-[var(--text-medium)]">{title}</p>
          <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
