// Driver Zones API Endpoint
// GET /api/driver/zones

import { NextRequest, NextResponse } from 'next/server';
import { getMobileUserFromRequest } from '@/lib/mobile-session';
import { prisma } from '@/lib/prisma';
import { errorResponse, jsonResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    // Authenticate driver
    const session = await getMobileUserFromRequest(request);
    if (!session || session.role !== 'DRIVER') {
      return errorResponse('Unauthorized', 401);
    }

    // Get all active areas with their base pricing
    const zones = await prisma.area.findMany({
      where: {
        active: true,
      },
      include: {
        ServiceAreaPrice: {
          where: {
            active: true,
          },
          include: {
            Service: {
              select: {
                id: true,
                name: true,
                priceCents: true,
              },
            },
          },
          orderBy: {
            priceCents: 'asc',
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Transform the data to match the expected Zone interface
    const transformedZones = zones.map(zone => ({
      id: zone.id,
      name: zone.name,
      description: zone.description,
      isActive: zone.active,
      priceCents: (zone as any).ServiceAreaPrice && (zone as any).ServiceAreaPrice.length > 0 
        ? (zone as any).ServiceAreaPrice[0].priceCents 
        : 5000, // Default to 50 AED if no pricing found
    }));

    return jsonResponse(transformedZones);

  } catch (error) {
    console.error('Error in driver zones API:', error);
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return errorResponse('Unauthorized', 401);
    }

    return errorResponse('Internal server error', 500);
  }
}
