import { ReactNode } from "react";
import { requireDriverSession } from "@/lib/driver-auth";

export const dynamic = "force-dynamic";

export default async function DriverLayout({ children }: { children: ReactNode }) {
  await requireDriverSession();

  return <main className="mx-auto max-w-5xl px-6 py-8 text-[var(--text-strong)]">{children}</main>;
}
