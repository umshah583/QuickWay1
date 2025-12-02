import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin-auth';

/**
 * Fix bookings that have partnerId set but no commission snapshot
 * This happens when bookings are linked directly to a partner without going through driver assignment
 */
export async function POST() {
  try {
    await requireAdminSession();

    console.log('🔍 Finding bookings without commission snapshots (including driver-linked)...');
    
    // Get default commission from settings
    const defaultCommissionSetting = await prisma.adminSetting.findUnique({
      where: { key: 'DEFAULT_PARTNER_COMMISSION_PERCENTAGE' },
      select: { value: true },
    });
    const defaultCommission = defaultCommissionSetting?.value 
      ? parseFloat(defaultCommissionSetting.value)
      : 100;

    console.log(`📝 Default commission: ${defaultCommission}%`);

    // Find bookings that belong to a partner (directly or via driver)
    // but still have NO commission snapshot
    const bookingsToFix = await prisma.booking.findMany({
      where: {
        partnerCommissionPercentage: null,
        OR: [
          { partnerId: { not: null } },
          { driver: { partnerId: { not: null } } },
        ],
      },
      select: {
        id: true,
        partnerId: true,
        driverId: true,
        status: true,
        taskStatus: true,
        createdAt: true,
        partner: {
          select: {
            id: true,
            name: true,
            commissionPercentage: true,
          },
        },
        driver: {
          select: {
            id: true,
            partnerId: true,
            partner: {
              select: {
                id: true,
                name: true,
                commissionPercentage: true,
              },
            },
          },
        },
      },
    });

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

    for (const booking of bookingsToFix) {
      // Determine the effective partner: direct on booking, or via driver
      const directPartner = booking.partner;
      const driverPartner = booking.driver?.partner;
      const effectivePartner = directPartner ?? driverPartner;
      const effectivePartnerId =
        booking.partnerId ?? booking.driver?.partnerId ?? effectivePartner?.id ?? null;

      if (!effectivePartner || !effectivePartnerId) {
        // Should not happen, but skip if we still cannot resolve partner
        continue;
      }

      // Use individual commission if > 0, otherwise use default
      const individualCommission = effectivePartner.commissionPercentage;
      const commissionToUse = (individualCommission && individualCommission > 0)
        ? individualCommission
        : defaultCommission;

      const source = booking.driverId ? 'via-driver' as const : 'direct' as const;
      if (source === 'direct') directPartnerCount++;
      else viaDriverCount++;

      // Update booking: ensure partnerId is set and snapshot the commission
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          partnerId: effectivePartnerId,
          partnerCommissionPercentage: commissionToUse,
        },
      });

      totalUpdated++;
      updates.push({
        bookingId: booking.id.substring(0, 8) + '...',
        partnerId: effectivePartnerId,
        partnerName: effectivePartner.name || 'Unknown',
        commission: commissionToUse,
        source,
      });
    }

    console.log(`✅ COMPLETE! Updated ${totalUpdated} bookings`);
    console.log(`   - Direct partner bookings: ${directPartnerCount}`);
    console.log(`   - Via driver bookings: ${viaDriverCount}`);

    return NextResponse.json({
      success: true,
      message: `✅ Successfully fixed ${totalUpdated} bookings`,
      totalBookings: bookingsToFix.length,
      bookingsFixed: totalUpdated,
      directPartnerBookings: directPartnerCount,
      viaDriverBookings: viaDriverCount,
      defaultCommission,
      updates: updates.slice(0, 50), // Show first 50 for brevity
    });

  } catch (error) {
    console.error('❌ Fix failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
