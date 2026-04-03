"use client";

import { useFormStatus } from "react-dom";
import { useState } from "react";
import Link from "next/link";

const BOOKING_STATUSES = ["ASSIGNED", "PENDING", "PAID", "CANCELLED"] as const;

type ServiceOption = {
  id: string;
  name: string;
  durationMin: number;
};

type DriverBreak = {
  id: string;
  reasonDisplay: string;
  startedAt: Date;
  endedAt: Date | null;
};

type DriverDay = {
  id: string;
  status: string;
};

type DriverOption = {
  id: string;
  name: string;
  email: string | null;
  DriverDay?: Array<{
    id: string;
    status: string;
    DriverBreak?: DriverBreak[];
  }>;
};

type BookingEditFormProps = {
  action: (formData: FormData) => Promise<void>;
  bookingId: string;
  services: ServiceOption[];
  drivers: DriverOption[];
  initialServiceId: string;
  initialStartAt: string;
  initialStatus: typeof BOOKING_STATUSES[number];
  initialDriverId: string | null;
  initialCashCollected: boolean;
  initialCashAmount: number;
  initialNotes: string | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Saving..." : "Save changes"}
    </button>
  );
}

function getDriverStatus(driver: DriverOption) {
  // Check if driver is currently on break
  const activeDay = driver.DriverDay?.[0];
  const activeBreak = activeDay?.DriverBreak?.find((break_) => !break_.endedAt);
  if (activeBreak) {
    return {
      status: 'on-break',
      label: 'On Break',
      reason: activeBreak.reasonDisplay,
      startedAt: activeBreak.startedAt,
    };
  }

  // Check if driver has an active day
  if (!activeDay || activeDay.status !== 'OPEN') {
    return {
      status: 'off-duty',
      label: 'Off Duty',
    };
  }

  return {
    status: 'available',
    label: 'Available',
  };
}

export default function BookingEditForm({
  action,
  bookingId,
  services,
  drivers,
  initialServiceId,
  initialStartAt,
  initialStatus,
  initialDriverId,
  initialCashCollected,
  initialCashAmount,
  initialNotes,
}: BookingEditFormProps) {
  const [selectedDriverId, setSelectedDriverId] = useState<string>(initialDriverId ?? "");
  
  const selectedDriver = drivers.find(driver => driver.id === selectedDriverId);
  const driverStatus = selectedDriver ? getDriverStatus(selectedDriver) : null;
  
  const isAssigningToDriverOnBreak = driverStatus?.status === 'on-break';

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="bookingId" value={bookingId} />

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-[var(--text-strong)]">Service</span>
        <select
          name="serviceId"
          defaultValue={initialServiceId}
          required
          className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
        >
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name} • {service.durationMin} min
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-[var(--text-strong)]">Start time</span>
        <input
          type="datetime-local"
          name="startAt"
          required
          defaultValue={initialStartAt}
          className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-[var(--text-strong)]">Assigned driver</span>
        <select
          name="driverId"
          value={selectedDriverId}
          onChange={(e) => setSelectedDriverId(e.target.value)}
          className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
        >
          <option value="">Unassigned</option>
          {drivers.map((driver) => {
            const status = getDriverStatus(driver);
            return (
              <option key={driver.id} value={driver.id}>
                {driver.name || driver.email || "Unnamed driver"} - {status.label}
              </option>
            );
          })}
        </select>
      </label>

      {/* Break Warning */}
      {isAssigningToDriverOnBreak && driverStatus && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400"></span>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-amber-800">
                ⚠️ Driver is currently on break
              </p>
              <p className="text-amber-700">
                {selectedDriver?.name || selectedDriver?.email} is on a {driverStatus.reason} break since{' '}
                {driverStatus.startedAt ? new Date(driverStatus.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently'}.
              </p>
              <p className="text-amber-600">
                Consider assigning this booking to another available driver or wait until the break ends.
              </p>
            </div>
          </div>
        </div>
      )}

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-[var(--text-strong)]">Status</span>
        <select
          name="status"
          defaultValue={initialStatus}
          required
          className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
        >
          {BOOKING_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="cashCollected"
          defaultChecked={initialCashCollected}
          className="h-4 w-4 rounded border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
        />
        <span className="text-[var(--text-strong)]">Cash collected</span>
      </label>

      <label className="flex flex-col gap-2 text-sm max-w-xs">
        <span className="font-medium text-[var(--text-strong)]">Cash amount (AED)</span>
        <input
          type="number"
          name="cashAmount"
          min={0}
          step="0.01"
          defaultValue={initialCashAmount ? (initialCashAmount / 100).toFixed(2) : ""}
          className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-[var(--text-strong)]">Driver notes</span>
        <textarea
          name="driverNotes"
          defaultValue={initialNotes ?? ""}
          rows={3}
          className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
        />
      </label>

      <div className="flex items-center gap-3">
        <SubmitButton />
        <Link
          href="/admin/bookings"
          className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-5 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
