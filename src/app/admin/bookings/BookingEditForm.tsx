"use client";

import { useFormStatus } from "react-dom";
import Link from "next/link";

const BOOKING_STATUSES = ["PENDING", "PAID", "CANCELLED"] as const;

type ServiceOption = {
  id: string;
  name: string;
  durationMin: number;
};

type DriverOption = {
  id: string;
  name: string;
  email: string | null;
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
          defaultValue={initialDriverId ?? ""}
          className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
        >
          <option value="">Unassigned</option>
          {drivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.name || driver.email || "Unnamed driver"}
            </option>
          ))}
        </select>
      </label>

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
