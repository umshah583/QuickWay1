import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin-auth';

export async function GET() {
  try {
    await requireAdminSession();

    // Get all partners with bookings
    const partners = await prisma.partner.findMany({
      select: {
        id: true,
        name: true,
        commissionPercentage: true,
        bookings: {
          select: {
            id: true,
            status: true,
            taskStatus: true,
            partnerCommissionPercentage: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20, // Last 20 bookings per partner
        },
        drivers: {
          select: {
            id: true,
            name: true,
            driverBookings: {
              select: {
                id: true,
                status: true,
                taskStatus: true,
                partnerCommissionPercentage: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 20, // Last 20 driver bookings
            },
          },
        },
      },
    });

    const diagnosis: Array<{
      partnerId: string;
      partnerName: string;
      currentCommission: number | null;
      bookingStats: {
        directBookings: number;
        directWithSnapshot: number;
        directWithoutSnapshot: number;
        driverBookings: number;
        driverWithSnapshot: number;
        driverWithoutSnapshot: number;
        total: number;
        totalWithSnapshot: number;
        totalWithoutSnapshot: number;
      };
      sampleBookings: Array<{
        id: string;
        status: string;
        taskStatus: string;
        hasSnapshot: boolean;
        snapshotValue: number | null;
        createdAt: string;
        source: 'direct' | 'driver';
      }>;
    }> = [];

    for (const partner of partners) {
      const directBookings = partner.bookings || [];
      const driverBookings = partner.drivers.flatMap(d => d.driverBookings || []);
      const allBookings = [...directBookings, ...driverBookings];

      const directWithSnapshot = directBookings.filter(b => b.partnerCommissionPercentage !== null).length;
      const directWithoutSnapshot = directBookings.filter(b => b.partnerCommissionPercentage === null).length;
      const driverWithSnapshot = driverBookings.filter(b => b.partnerCommissionPercentage !== null).length;
      const driverWithoutSnapshot = driverBookings.filter(b => b.partnerCommissionPercentage === null).length;

      const sampleBookings = allBookings.slice(0, 10).map(b => {
        const isDirect = directBookings.some(db => db.id === b.id);
        return {
          id: b.id.substring(0, 8) + '...',
          status: b.status,
          taskStatus: b.taskStatus,
          hasSnapshot: b.partnerCommissionPercentage !== null,
          snapshotValue: b.partnerCommissionPercentage,
          createdAt: b.createdAt.toISOString(),
          source: isDirect ? 'direct' as const : 'driver' as const,
        };
      });

      diagnosis.push({
        partnerId: partner.id,
        partnerName: partner.name || 'Unknown',
        currentCommission: partner.commissionPercentage,
        bookingStats: {
          directBookings: directBookings.length,
          directWithSnapshot,
          directWithoutSnapshot,
          driverBookings: driverBookings.length,
          driverWithSnapshot,
          driverWithoutSnapshot,
          total: allBookings.length,
          totalWithSnapshot: directWithSnapshot + driverWithSnapshot,
          totalWithoutSnapshot: directWithoutSnapshot + driverWithoutSnapshot,
        },
        sampleBookings,
      });
    }

    const summary = {
      totalPartners: partners.length,
      partnersWithIssues: diagnosis.filter(d => d.bookingStats.totalWithoutSnapshot > 0).length,
      totalBookingsWithoutSnapshot: diagnosis.reduce((sum, d) => sum + d.bookingStats.totalWithoutSnapshot, 0),
    };

    return NextResponse.json({
      success: true,
      summary,
      partners: diagnosis,
    });
  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
