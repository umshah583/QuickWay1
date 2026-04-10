import { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ModernSidebar } from "@/app/components/ModernSidebar";
import { DashboardHeader } from "@/app/components/DashboardHeader";
import { MobileNav } from "@/app/components/MobileNav";
import { MobileSidebar } from "@/app/components/MobileSidebar";
import { AdminLiveUpdates } from "@/components/AdminLiveUpdates";
import { AdminClientWrapper } from "./AdminClientWrapper";

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
  const sessionRoleKey = (session?.user as any)?.roleKey;
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
    select: { 
      role: true,
      roleId: true,
      Role: {
        select: {
          key: true,
          name: true,
        }
      }
    },
  });

  // Check roleKey for admin-like roles (admin, manager, etc.)
  const roleKey = sessionRoleKey?.toLowerCase() ?? dbUser?.Role?.key?.toLowerCase() ?? dbUser?.role?.toLowerCase();
  const isAdmin = ['admin', 'manager'].includes(roleKey || '');
  if (!isAdmin) {
    redirect("/sign-in?callbackUrl=/admin");
  }

  const unreadNotifications = await prisma.notification.count({ where: { read: false } });
  const newBookingsCount = await prisma.booking.count({ where: { status: "PENDING" } });
  const pendingSubscriptionRequests = await prisma.subscriptionRequest.count({ where: { status: "PENDING" } });

  return (
    <AdminClientWrapper>
      <div className="flex min-h-screen bg-[var(--background)]">
        <AdminLiveUpdates />
        
        {/* Desktop Sidebar - Hidden on mobile/tablet */}
        <div className="hidden lg:block">
          <ModernSidebar 
            notificationsCount={unreadNotifications} 
            bookingsNewCount={newBookingsCount}
            subscriptionRequestsCount={pendingSubscriptionRequests}
          />
        </div>
        
        {/* Mobile Collapsible Sidebar */}
        <MobileSidebar />
        
        {/* Main Content */}
        <main className="flex-1 lg:ml-64 pb-20 md:pb-0">
          <div className="mx-auto max-w-[1600px] p-4 md:p-6 pt-20 lg:pt-6">
            <DashboardHeader 
              notificationsCount={unreadNotifications}
            />
            {children}
          </div>
        </main>
        
        {/* Mobile Bottom Navigation */}
        <MobileNav />
      </div>
    </AdminClientWrapper>
  );
}
