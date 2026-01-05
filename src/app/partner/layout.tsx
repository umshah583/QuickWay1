import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requirePartnerSession } from "@/lib/partner-auth";
import prisma from "@/lib/prisma";
import { ModernSidebar } from "@/app/components/ModernSidebar";
import { PartnerClientWrapper } from "./PartnerClientWrapper";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "Partner Dashboard | Quickway",
  description: "Manage your partner operations and drivers for Quickway.",
};

interface PartnerLayoutProps {
  children: ReactNode;
}

export default async function PartnerLayout({ children }: PartnerLayoutProps) {
  const session = await requirePartnerSession();
  const partnerUserId = session.user?.id;
  const partnerRole = session.user?.role;

  if (!partnerUserId || partnerRole !== "PARTNER") {
    redirect("/sign-in?callbackUrl=/partner");
  }

  // Get partner-specific counts for sidebar badges
  const partnerRecord = await prisma.partner.findUnique({
    where: { userId: partnerUserId },
    select: { id: true },
  });

  let newBookingsCount = 0;

  if (partnerRecord) {
    const drivers = await prisma.user.findMany({
      where: { partnerId: partnerRecord.id },
      select: { id: true },
    });
    const driverIds = drivers.map((d) => d.id);

    const bookingsWhere =
      driverIds.length > 0
        ? {
            OR: [
              { partnerId: partnerRecord.id },
              { driverId: { in: driverIds } },
            ],
            status: "PENDING" as const,
          }
        : { partnerId: partnerRecord.id, status: "PENDING" as const };

    newBookingsCount = await prisma.booking.count({ where: bookingsWhere });
  }

  return (
    <PartnerClientWrapper>
      <div className="flex min-h-screen bg-[var(--background)]">
        <ModernSidebar 
          notificationsCount={0} 
          bookingsNewCount={newBookingsCount}
          userRole="PARTNER"
        />
        <main className="ml-64 flex-1 p-6">
          <div className="mx-auto max-w-[1600px]">
            {children}
          </div>
        </main>
      </div>
    </PartnerClientWrapper>
  );
}
