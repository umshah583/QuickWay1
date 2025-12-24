"use client";

import { useRouter } from "next/navigation";
import { format } from "date-fns";

export default function DateFilter({ currentDate }: { currentDate: string }) {
  const router = useRouter();

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    router.push(`/admin/business-day?date=${newDate}`);
  };

  const goToToday = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    router.push(`/admin/business-day?date=${today}`);
  };

  const isToday = currentDate === format(new Date(), "yyyy-MM-dd");

  return (
    <div className="flex items-center gap-3">
      <input
        type="date"
        value={currentDate}
        onChange={handleDateChange}
        className="px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface)] text-[var(--text-strong)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
      />
      {!isToday && (
        <button
          onClick={goToToday}
          className="px-3 py-2 text-sm font-medium text-[var(--brand-primary)] hover:bg-[var(--surface-secondary)] rounded-lg transition-colors"
        >
          Today
        </button>
      )}
    </div>
  );
}
