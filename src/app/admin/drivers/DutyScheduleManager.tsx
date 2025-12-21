"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DriverDutyShift } from "@/lib/admin-settings";
import {
  addDriverDutyShift,
  updateDriverDutyShift,
  deleteDriverDutyShift,
} from "@/app/admin/drivers/actions";

type WeeklySchedule = Record<string, DriverDutyShift[]>;

type DutyScheduleManagerProps = {
  driverId: string;
  weeklySchedule?: WeeklySchedule;
};

const dayOptions = [
  { code: "MON", label: "Monday" },
  { code: "TUE", label: "Tuesday" },
  { code: "WED", label: "Wednesday" },
  { code: "THU", label: "Thursday" },
  { code: "FRI", label: "Friday" },
  { code: "SAT", label: "Saturday" },
  { code: "SUN", label: "Sunday" },
];

type ModalState =
  | { mode: "add"; day: string; startTime: string; endTime: string }
  | { mode: "edit"; day: string; index: number; startTime: string; endTime: string };

const defaultModalState: ModalState = {
  mode: "add",
  day: "MON",
  startTime: "09:00",
  endTime: "18:00",
};

function formatShiftLabel(shift: DriverDutyShift) {
  return `${shift.startTime} – ${shift.endTime}`;
}

export function DutyScheduleManager({ driverId, weeklySchedule = {} }: DutyScheduleManagerProps) {
  const router = useRouter();
  const [isModalOpen, setModalOpen] = useState(false);
  const [modalState, setModalState] = useState<ModalState>(defaultModalState);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => {
    return dayOptions.map((day) => ({
      ...day,
      shifts: weeklySchedule[day.code] ?? [],
    }));
  }, [weeklySchedule]);

  const openAddModal = () => {
    setError(null);
    setModalState(defaultModalState);
    setModalOpen(true);
  };

  const openEditModal = (day: string, index: number, shift: DriverDutyShift) => {
    setError(null);
    setModalState({
      mode: "edit",
      day,
      index,
      startTime: shift.startTime,
      endTime: shift.endTime,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalState(defaultModalState);
  };

  const handleSubmit = () => {
    if (!modalState.startTime || !modalState.endTime) {
      setError("Both start and end time are required.");
      return;
    }

    startTransition(async () => {
      try {
        if (modalState.mode === "add") {
          await addDriverDutyShift(driverId, {
            day: modalState.day,
            startTime: modalState.startTime,
            endTime: modalState.endTime,
          });
        } else {
          await updateDriverDutyShift(driverId, {
            day: modalState.day,
            index: modalState.index,
            startTime: modalState.startTime,
            endTime: modalState.endTime,
          });
        }
        closeModal();
        router.refresh();
      } catch (err) {
        console.error("Failed to save duty shift", err);
        setError(err instanceof Error ? err.message : "Failed to save shift");
      }
    });
  };

  const handleDelete = (day: string, index: number) => {
    const confirmed = window.confirm("Remove this shift?");
    if (!confirmed) return;

    startTransition(async () => {
      try {
        await deleteDriverDutyShift(driverId, { day, index });
        router.refresh();
      } catch (err) {
        console.error("Failed to delete shift", err);
        setError(err instanceof Error ? err.message : "Failed to delete shift");
      }
    });
  };

  const modalTitle = modalState.mode === "add" ? "Add duty timing" : "Edit duty timing";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-[var(--text-strong)]">Duty schedule</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Add daily duty windows and manage them in one place. Split shifts are supported.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)]"
        >
          + Add timing
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
            <tr>
              <th className="px-4 py-3 text-left">Day</th>
              <th className="px-4 py-3 text-left">Duty windows</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.code} className="border-t border-[var(--surface-border)]">
                <td className="px-4 py-3 font-semibold text-[var(--text-strong)]">{row.label}</td>
                <td className="px-4 py-3 text-[var(--text-muted)]">
                  {row.shifts.length === 0 ? (
                    <span className="text-xs italic">No timings configured</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {row.shifts.map((shift, index) => (
                        <span
                          key={`${row.code}-${index}-${shift.startTime}`}
                          className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-medium text-[var(--text-strong)]"
                        >
                          {formatShiftLabel(shift)}
                          <button
                            type="button"
                            onClick={() => openEditModal(row.code, index, shift)}
                            className="text-[var(--brand-primary)] hover:underline"
                          >
                            Edit
                          </button>
                          <span aria-hidden="true">·</span>
                          <button
                            type="button"
                            onClick={() => handleDelete(row.code, index)}
                            className="text-[var(--danger)] hover:underline"
                          >
                            Delete
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-[var(--text-muted)] text-xs">
                  {row.shifts.length ? `${row.shifts.length} shift${row.shifts.length > 1 ? "s" : ""}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--text-strong)]">{modalTitle}</h3>
              <button onClick={closeModal} className="text-[var(--text-muted)] hover:text-[var(--text-strong)]">
                ✕
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-medium text-[var(--text-strong)]">
                Day
                <select
                  className="mt-1 w-full rounded-lg border border-[var(--surface-border)] px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
                  value={modalState.day}
                  disabled={modalState.mode === "edit"}
                  onChange={(event) =>
                    setModalState((prev) => ({
                      ...prev,
                      day: event.target.value,
                    }))
                  }
                >
                  {dayOptions.map((day) => (
                    <option key={day.code} value={day.code}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-[var(--text-strong)]">
                Start time
                <input
                  type="time"
                  className="mt-1 w-full rounded-lg border border-[var(--surface-border)] px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
                  value={modalState.startTime}
                  onChange={(event) =>
                    setModalState((prev) => ({
                      ...prev,
                      startTime: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="block text-sm font-medium text-[var(--text-strong)]">
                End time
                <input
                  type="time"
                  className="mt-1 w-full rounded-lg border border-[var(--surface-border)] px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
                  value={modalState.endTime}
                  onChange={(event) =>
                    setModalState((prev) => ({
                      ...prev,
                      endTime: event.target.value,
                    }))
                  }
                />
              </label>

              {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isPending}
                  className="rounded-full bg-[var(--brand-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)] disabled:opacity-70"
                >
                  {isPending ? "Saving..." : "Save timing"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
