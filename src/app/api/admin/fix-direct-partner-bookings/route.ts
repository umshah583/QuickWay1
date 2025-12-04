import { NextResponse } from 'next/server';
import prisma, { Prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin-auth';

/**
 * Backfill partnerCommissionPercentage snapshots for all partner-related bookings
 * (both direct partner bookings and driver-linked bookings).
 *
 * This is the production-safe version that walks partners and their
 * bookings/driverBookings, instead of relying on complex relational
 * filters on Booking.
 */
export async function POST() {
  try {
    await requireAdminSession();

    console.log('🔍 Backfilling commission snapshots for partner bookings (direct + via driver)...');

    // Get default commission from settings
    const defaultCommissionSetting = await prisma.adminSetting.findUnique({
      where: { key: 'DEFAULT_PARTNER_COMMISSION_PERCENTAGE' },
      select: { value: true },
    });
    const defaultCommission = defaultCommissionSetting?.value
      ? parseFloat(defaultCommissionSetting.value)
      : 100;

    console.log(`📝 Default commission: ${defaultCommission}%`);

    // Load partners with their direct bookings and driver bookings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawPartners = await (prisma.partner as any).findMany({
      select: {
        id: true,
        name: true,
        commissionPercentage: true,
        bookings: {
          select: {
            id: true,
            partnerCommissionPercentage: true,
          },
        },
        drivers: {
          select: {
            id: true,
            driverBookings: {
              select: {
                id: true,
                partnerCommissionPercentage: true,
              },
            },
          },
        },
      },
    });

    const partners = rawPartners as Array<{
      id: string;
      name: string | null;
      commissionPercentage: number | null;
      bookings: Array<{
        id: string;
        partnerCommissionPercentage: number | null;
      }>;
      drivers: Array<{
        id: string;
        driverBookings: Array<{
          id: string;
          partnerCommissionPercentage: number | null;
        }>;
      }>;
    }>;

    let totalUpdated = 0;
    let directPartnerCount = 0;
    let viaDriverCount = 0;
    const updates: Array<{
      bookingId: string;
      partnerId: string;
      partnerName: string;
      commission: number;
      source: 'direct' | 'via-driver';
    }> = [];

    const updatedBookingIds = new Set<string>();

    for (const partner of partners) {
      const partnerId = partner.id;
      const partnerName = partner.name ?? 'Unknown';

      // If partner commission is 0 or null, fall back to default
      const individualCommission = partner.commissionPercentage;
      const commissionToUse =
        individualCommission && individualCommission > 0
          ? individualCommission
          : defaultCommission;

      // Direct partner bookings
      for (const booking of partner.bookings) {
        if (typeof booking.partnerCommissionPercentage === 'number') {
          continue;
        }

        if (updatedBookingIds.has(booking.id)) {
          continue;
        }

        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            partnerId,
            partnerCommissionPercentage: commissionToUse,
          } as unknown as Prisma.BookingUpdateInput,
        });

        updatedBookingIds.add(booking.id);
        totalUpdated++;
        directPartnerCount++;
        updates.push({
          bookingId: booking.id.substring(0, 8) + '...',
          partnerId,
          partnerName,
          commission: commissionToUse,
          source: 'direct',
        });
      }

      // Driver-linked bookings for this partner
      for (const driver of partner.drivers) {
        for (const booking of driver.driverBookings) {
          if (typeof booking.partnerCommissionPercentage === 'number') {
            continue;
          }

          if (updatedBookingIds.has(booking.id)) {
            continue;
          }

          await prisma.booking.update({
            where: { id: booking.id },
            data: {
              partnerId,
              partnerCommissionPercentage: commissionToUse,
            } as unknown as Prisma.BookingUpdateInput,
          });

          updatedBookingIds.add(booking.id);
          totalUpdated++;
          viaDriverCount++;
          updates.push({
            bookingId: booking.id.substring(0, 8) + '...',
            partnerId,
            partnerName,
            commission: commissionToUse,
            source: 'via-driver',
          });
        }
      }
    }

    console.log(`✅ COMPLETE! Updated ${totalUpdated} bookings`);
    console.log(`   - Direct partner bookings: ${directPartnerCount}`);
    console.log(`   - Via driver bookings: ${viaDriverCount}`);

    return NextResponse.json({
      success: true,
      message: `✅ Successfully fixed ${totalUpdated} bookings`,
      totalBookings: updatedBookingIds.size,
      bookingsFixed: totalUpdated,
      directPartnerBookings: directPartnerCount,
      viaDriverBookings: viaDriverCount,
      defaultCommission,
      updates: updates.slice(0, 50),
    });
  } catch (error) {
    console.error('❌ Fix failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
