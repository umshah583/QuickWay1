import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin-auth';

export async function POST() {
  try {
    // Require admin authentication
    await requireAdminSession();

    console.log('🔍 Finding bookings without commission snapshots...');
    
    // Get default commission from settings
    const defaultCommissionSetting = await prisma.adminSetting.findUnique({
      where: { key: 'DEFAULT_PARTNER_COMMISSION_PERCENTAGE' },
      select: { value: true },
    });
    const defaultCommission = defaultCommissionSetting?.value 
      ? parseFloat(defaultCommissionSetting.value)
      : 100;

    console.log(`📝 Default commission: ${defaultCommission}%`);

    // Find all bookings without snapshots that have a partner
    const bookings = await prisma.booking.findMany({
      where: {
        partnerId: { not: null },
      },
      select: {
        id: true,
        partnerId: true,
        partnerCommissionPercentage: true,
      },
    });

    const bookingsWithoutSnapshot = bookings.filter(b => b.partnerCommissionPercentage === null);
    
    console.log(`📊 Total bookings: ${bookings.length}`);
    console.log(`📊 Bookings without snapshots: ${bookingsWithoutSnapshot.length}`);

    if (bookingsWithoutSnapshot.length === 0) {
      return NextResponse.json({
        success: true,
        message: '✅ All bookings already have commission snapshots!',
        updated: 0,
      });
    }

    // Get unique partner IDs
    const partnerIds = [...new Set(bookingsWithoutSnapshot.map(b => b.partnerId).filter(Boolean))] as string[];
    
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
    const updates: Array<{ partnerId: string; partnerName: string; count: number; commission: number }> = [];

    // Group by partner and update
    for (const partnerId of partnerIds) {
      const partner = partnerMap.get(partnerId);
      if (!partner) continue;

      const partnerBookings = bookingsWithoutSnapshot.filter(b => b.partnerId === partnerId);
      
      // Use individual commission if > 0, otherwise use default
      const individualCommission = partner.commissionPercentage;
      const commissionToUse = (individualCommission && individualCommission > 0)
        ? individualCommission
        : defaultCommission;

      console.log(`📦 Partner: ${partner.name} - Updating ${partnerBookings.length} bookings with ${commissionToUse}%`);

      // Update all bookings for this partner in batch
      await prisma.booking.updateMany({
        where: {
          id: { in: partnerBookings.map(b => b.id) },
        },
        data: {
          partnerCommissionPercentage: commissionToUse,
        },
      });

      totalUpdated += partnerBookings.length;
      updates.push({
        partnerId,
        partnerName: partner.name || 'Unknown',
        count: partnerBookings.length,
        commission: commissionToUse,
      });
    }

    console.log(`✅ COMPLETE! Updated ${totalUpdated} bookings`);

    return NextResponse.json({
      success: true,
      message: `✅ Successfully backfilled ${totalUpdated} bookings`,
      totalBookings: bookings.length,
      bookingsWithSnapshots: bookings.length - bookingsWithoutSnapshot.length,
      bookingsUpdated: totalUpdated,
      defaultCommission,
      partnerUpdates: updates,
    });

  } catch (error) {
    console.error('❌ Backfill failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
