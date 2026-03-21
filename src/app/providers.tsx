"use client";

import { SessionProvider } from "next-auth/react";
import { CategoryNavigationProvider } from "@/context/CategoryNavigationContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CategoryNavigationProvider>{children}</CategoryNavigationProvider>
    </SessionProvider>
  );
}
