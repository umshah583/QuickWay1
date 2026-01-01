import { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ModernSidebar } from "@/app/components/ModernSidebar";
import { AdminLiveUpdates } from "@/components/AdminLiveUpdates";

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
  const pendingSubscriptionRequests = await prisma.subscriptionRequest.count({ where: { status: "PENDING" } });

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <AdminLiveUpdates />
      <ModernSidebar 
        notificationsCount={unreadNotifications} 
        bookingsNewCount={newBookingsCount}
        subscriptionRequestsCount={pendingSubscriptionRequests}
      />
      <main className="ml-64 flex-1 p-6">
        <div className="mx-auto max-w-[1600px]">
          {children}
        </div>
      </main>
    </div>
  );
}
