// Driver Services by Location API Endpoint
// GET /api/driver/services-by-location?lat=...&lng=...

import { NextRequest, NextResponse } from 'next/server';
import { getMobileUserFromRequest } from '@/lib/mobile-session';
import { prisma } from '@/lib/prisma';
import { errorResponse, jsonResponse } from '@/lib/api-response';
import { z } from 'zod';

// Query parameter schema
const QuerySchema = z.object({
  lat: z.string().transform(val => parseFloat(val)),
  lng: z.string().transform(val => parseFloat(val)),
}).refine(data => !isNaN(data.lat) && !isNaN(data.lng), {
  message: "lat and lng must be valid numbers"
});

interface ServiceWithPricing {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  basePriceCents: number;
  priceCents: number;
  discountPercentage: number | null;
  zoneId: string | null;
  zoneName: string | null;
  pricingSource: 'ZONE_PRICE' | 'BASE_PRICE';
  carTypes: string[];
  imageUrl: string | null;
  active: boolean;
}

/**
 * Point-in-Polygon algorithm for checking if coordinates are inside an area
 */
function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [lat, lng] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [lat_i, lng_i] = polygon[i];
    const [lat_j, lng_j] = polygon[j];

    if (((lng_i > lng) !== (lng_j > lng)) && (lat < (lat_j - lat_i) * (lng - lng_i) / (lng_j - lng_i) + lat_i)) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Find which zone contains the given coordinates
 */
async function findZoneForLocation(lat: number, lng: number) {
  const zones = await prisma.area.findMany({
    where: {
      active: true,
      polygonJson: {
        not: null
      }
    },
    select: {
      id: true,
      name: true,
      polygonJson: true,
    },
  });

  for (const zone of zones) {
    if (!zone.polygonJson) continue;

    try {
      const polygon = JSON.parse(zone.polygonJson) as [number, number][];
      if (isPointInPolygon([lat, lng], polygon)) {
        return zone;
      }
    } catch (error) {
      console.warn(`Invalid polygon JSON for zone ${zone.id}:`, error);
      continue;
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate driver
    const session = await getMobileUserFromRequest(request);
    if (!session || session.role !== 'DRIVER') {
      return errorResponse('Unauthorized', 401);
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    
    // Validate location parameters if provided
    let currentZone = null;
    let latitude = 0;
    let longitude = 0;
    
    if (lat && lng) {
      const validation = QuerySchema.safeParse({ lat, lng });
      if (!validation.success) {
        return errorResponse('Invalid query parameters', 400);
      }
      latitude = validation.data.lat;
      longitude = validation.data.lng;
      console.log(`[Driver Services by Location] Driver ${session.sub} requesting services for location: ${latitude}, ${longitude}`);
      
      // Find which zone the driver is in
      currentZone = await findZoneForLocation(latitude, longitude);
      console.log(`[Driver Services by Location] Driver in zone:`, currentZone?.name || 'No zone found');
    } else {
      console.log(`[Driver Services by Location] Driver ${session.sub} requesting services without location`);
    }

    // Get all active services
    const services = await prisma.service.findMany({
      where: {
        active: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        durationMin: true,
        priceCents: true,
        discountPercentage: true,
        carTypes: true,
        imageUrl: true,
        active: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Get zone-specific pricing if driver is in a zone
    let zonePricing: Map<string, { priceCents: number; discountPercentage: number | null }> = new Map();
    
    if (currentZone) {
      const serviceAreaPrices = await prisma.serviceAreaPrice.findMany({
        where: {
          areaId: currentZone.id,
          active: true,
          serviceId: {
            in: services.map(s => s.id),
          },
        },
        select: {
          serviceId: true,
          priceCents: true,
          discountPercentage: true,
        },
      });

      serviceAreaPrices.forEach(price => {
        zonePricing.set(price.serviceId, {
          priceCents: price.priceCents,
          discountPercentage: price.discountPercentage,
        });
      });
    }

    // Combine services with pricing information
    const servicesWithPricing: ServiceWithPricing[] = services.map(service => {
      const zonePrice = zonePricing.get(service.id);
      
      if (zonePrice) {
        // Use zone-specific pricing
        return {
          ...service,
          basePriceCents: service.priceCents,
          priceCents: zonePrice.priceCents,
          discountPercentage: zonePrice.discountPercentage,
          zoneId: currentZone?.id || null,
          zoneName: currentZone?.name || null,
          pricingSource: 'ZONE_PRICE' as const,
        };
      } else {
        // Use base pricing
        return {
          ...service,
          basePriceCents: service.priceCents,
          priceCents: service.priceCents,
          discountPercentage: service.discountPercentage,
          zoneId: null,
          zoneName: null,
          pricingSource: 'BASE_PRICE' as const,
        };
      }
    });

    console.log(`[Driver Services by Location] Returning ${servicesWithPricing.length} services for driver ${session.sub}`);

    return jsonResponse({
      services: servicesWithPricing,
      currentLocation: {
        latitude: latitude,
        longitude: longitude,
        zone: currentZone ? {
          id: currentZone.id,
          name: currentZone.name,
        } : null,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error in driver services by location API:', error);
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return errorResponse('Unauthorized', 401);
    }

    return errorResponse('Internal server error', 500);
  }
}
