import { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import AdminNav from "./AdminNav";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "Admin | Quickway",
  description: "Manage services, bookings, and schedules for Quickway.",
};

interface AdminLayoutProps {
  children: ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await getServerSession(authOptions);
  const sessionRole = session?.user?.role;
  const sessionId = session?.user?.id;
  const sessionEmail = session?.user?.email;

  if (!session) {
    redirect("/sign-in?callbackUrl=/admin");
  }

  const identifierFilters: Prisma.UserWhereInput[] = [];
  if (sessionId) {
    identifierFilters.push({ id: sessionId });
  }
  if (sessionEmail) {
    identifierFilters.push({ email: sessionEmail });
  }

  const dbUser = await prisma.user.findFirst({
    where: identifierFilters.length ? { OR: identifierFilters } : undefined,
    select: { role: true },
  });

  const isAdmin = sessionRole === "ADMIN" || dbUser?.role === "ADMIN";
  if (!isAdmin) {
    redirect("/sign-in?callbackUrl=/admin");
  }

  const unreadNotifications = await prisma.notification.count({ where: { read: false } });
  const newBookingsCount = await prisma.booking.count({ where: { status: "PENDING" } });

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[var(--background)] print:bg-white">
      <div className="mx-auto flex w-full max-w-7xl gap-8 px-6 py-10 print:block print:max-w-none print:gap-0 print:px-0 print:py-0">
        <aside className="hidden w-56 shrink-0 lg:block print:hidden">
          <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--brand-primary)]">
              Admin
            </p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--text-strong)]">
              Control Center
            </h2>
            <div className="mt-6">
              <AdminNav notificationsCount={unreadNotifications} bookingsNewCount={newBookingsCount} />
            </div>
          </div>
        </aside>
        <main className="flex-1 space-y-8 print:space-y-0 print:block">
          <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-sm print:border-0 print:p-0 print:shadow-none print:bg-white">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
