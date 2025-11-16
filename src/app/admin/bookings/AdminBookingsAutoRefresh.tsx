"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_INTERVAL_MS = 15000;

export default function AdminBookingsAutoRefresh({ intervalMs = DEFAULT_INTERVAL_MS }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleRefresh = () => {
      timer = setTimeout(() => {
        if (document.visibilityState === "visible") {
          router.refresh();
        }
        scheduleRefresh();
      }, intervalMs);
    };

    scheduleRefresh();

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [intervalMs, router]);

  return null;
}
