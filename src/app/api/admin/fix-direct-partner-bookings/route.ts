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

    console.log('🔍 Finding bookings with partnerId but no commission snapshot...');
    
    // Get default commission from settings
    const defaultCommissionSetting = await prisma.adminSetting.findUnique({
      where: { key: 'DEFAULT_PARTNER_COMMISSION_PERCENTAGE' },
      select: { value: true },
    });
    const defaultCommission = defaultCommissionSetting?.value 
      ? parseFloat(defaultCommissionSetting.value)
      : 100;

    console.log(`📝 Default commission: ${defaultCommission}%`);

    // Find bookings with partnerId but NO snapshot and NO driver
    const directPartnerBookings = await prisma.booking.findMany({
      where: {
        partnerId: { not: null },
        // partnerCommissionPercentage: null,  // Can't filter by this in query
      },
      select: {
        id: true,
        partnerId: true,
        driverId: true,
        status: true,
        taskStatus: true,
        createdAt: true,
      },
    });

    // Filter in JavaScript (since Prisma doesn't support filtering by null on this field yet)
    const bookingsToFix = await Promise.all(
      directPartnerBookings.map(async (booking) => {
        const fullBooking = await prisma.booking.findUnique({
          where: { id: booking.id },
          select: {
            id: true,
            partnerId: true,
            driverId: true,
            status: true,
            taskStatus: true,
            createdAt: true,
          },
        });
        return fullBooking;
      })
    );

    // Get unique partner IDs
    const partnerIds = [...new Set(bookingsToFix.map(b => b?.partnerId).filter(Boolean))] as string[];
    
    // Fetch all partners
    const partners = await prisma.partner.findMany({
      where: { id: { in: partnerIds } },
      select: {
        id: true,
        name: true,
        commissionPercentage: true,
      },
    });

    const partnerMap = new Map(partners.map(p => [p.id, p]));

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
      if (!booking?.partnerId) continue;
      
      const partner = partnerMap.get(booking.partnerId);
      if (!partner) continue;

      // Use individual commission if > 0, otherwise use default
      const individualCommission = partner.commissionPercentage;
      const commissionToUse = (individualCommission && individualCommission > 0)
        ? individualCommission
        : defaultCommission;

      const source = booking.driverId ? 'via-driver' as const : 'direct' as const;
      if (source === 'direct') directPartnerCount++;
      else viaDriverCount++;

      await prisma.booking.updateMany({
        where: { id: booking.id },
        data: {
          partnerCommissionPercentage: commissionToUse,
        } as any, // Type assertion needed - field exists but not in updateMany types yet
      });

      totalUpdated++;
      updates.push({
        bookingId: booking.id.substring(0, 8) + '...',
        partnerId: booking.partnerId,
        partnerName: partner.name || 'Unknown',
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
      totalBookings: directPartnerBookings.length,
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
