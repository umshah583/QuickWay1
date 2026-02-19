// GPS-Based Pricing API Endpoints
// Node.js/Next.js API routes

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Request/Response schemas
const PricingByLocationRequestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  service_ids: z.array(z.string()).min(1).max(50),
  datetime: z.string().optional(), // ISO datetime string
});

const ZoneLookupQuerySchema = z.object({
  lat: z.string().transform(val => parseFloat(val)),
  lng: z.string().transform(val => parseFloat(val)),
}).refine(data => !isNaN(data.lat) && !isNaN(data.lng), {
  message: "lat and lng must be valid numbers"
});

interface PricingResult {
  service_id: string;
  price: number;
  source: 'ZONE_PRICE' | 'BASE_PRICE';
  zone_id?: string;
  discount_percentage?: number;
  valid_from?: string;
  valid_to?: string;
}

// Cache for service prices (zone-based)
const priceCache = new Map<string, { prices: PricingResult[]; expiresAt: Date }>();
const PRICE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

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
 * Resolve area from coordinates using polygon matching
 */
async function resolveAreaFromCoordinates(lat: number, lng: number): Promise<string | null> {
  try {
    // Get all active areas with polygons
    const areas = await prisma.area.findMany({
      where: {
        active: true,
        polygonJson: { not: null },
      },
      select: {
        id: true,
        polygonJson: true,
        sortOrder: true,
      },
      orderBy: { sortOrder: 'desc' },
    });

    // Check each area's polygon
    for (const area of areas) {
      if (!area.polygonJson) continue;

      try {
        const polygon = JSON.parse(area.polygonJson);
        
        // Validate GeoJSON Polygon structure
        if (polygon.type === 'Polygon' && Array.isArray(polygon.coordinates) && polygon.coordinates[0]) {
          // GeoJSON uses [lng, lat] format, convert to [lat, lng] for our algorithm
          const coords: [number, number][] = polygon.coordinates[0].map(
            ([lng, lat]: [number, number]) => [lat, lng]
          );

          if (isPointInPolygon([lat, lng], coords)) {
            return area.id;
          }
        }
      } catch (parseError) {
        console.error(`Failed to parse polygon for area ${area.id}:`, parseError);
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error('Error resolving area from coordinates:', error);
    return null;
  }
}

/**
 * Get service prices for an area with fallback to base prices
 */
async function getServicePrices(areaId: string | null, serviceIds: string[], datetime?: Date) {
  const cacheKey = `${areaId || 'global'}_${serviceIds.sort().join(',')}_${datetime?.toISOString() || 'now'}`;

  // Check cache
  const cached = priceCache.get(cacheKey);
  if (cached && cached.expiresAt > new Date()) {
    return cached.prices;
  }

  const results: PricingResult[] = [];

  for (const serviceId of serviceIds) {
    let price: PricingResult | null = null;

    // First try area-specific price
    if (areaId) {
      const areaPrice = await prisma.serviceAreaPrice.findFirst({
        where: {
          areaId: areaId,
          serviceId: serviceId,
          active: true,
        },
      });

      if (areaPrice) {
        price = {
          service_id: serviceId,
          price: areaPrice.priceCents,
          source: 'ZONE_PRICE',
          zone_id: areaId,
          discount_percentage: areaPrice.discountPercentage || 0,
        };
      }
    }

    // Fallback to base service price if no area price found
    if (!price) {
      const service = await prisma.service.findUnique({
        where: { id: serviceId },
        select: { priceCents: true },
      });

      if (service && service.priceCents) {
        price = {
          service_id: serviceId,
          price: service.priceCents,
          source: 'BASE_PRICE',
          discount_percentage: 0,
        };
      }
    }

    if (price) {
      results.push(price);
    }
  }

  // Cache the results
  priceCache.set(cacheKey, {
    prices: results,
    expiresAt: new Date(Date.now() + PRICE_CACHE_TTL)
  });

  return results;
}

/**
 * POST /api/pricing/by-location
 * Get service prices based on user location
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const validation = PricingByLocationRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { lat, lng, service_ids, datetime } = validation.data;
    const targetDate = datetime ? new Date(datetime) : new Date();

    // Resolve area/zone
    const areaId = await resolveAreaFromCoordinates(lat, lng);

    // Get prices
    const prices = await getServicePrices(areaId, service_ids, targetDate);

    // Get area details if found
    let areaDetails = null;
    if (areaId) {
      const area = await prisma.area.findUnique({
        where: { id: areaId },
        select: { id: true, name: true, description: true },
      });
      if (area) {
        areaDetails = {
          id: area.id,
          name: area.name,
          description: area.description,
        };
      }
    }

    // Build response
    const response = {
      zone: areaDetails,
      prices,
      currency_symbol: 'AED',
      requested_at: new Date().toISOString(),
      target_datetime: targetDate.toISOString(),
      explanation: {
        zone_resolved_by: areaId ? 'polygon_match' : 'none',
        matched_zone_count: areaId ? 1 : 0,
        total_services_requested: service_ids.length,
        total_prices_returned: prices.length,
        zone_resolution_explanation: areaId ? 'Coordinates matched to area polygon' : 'No area found for coordinates',
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in pricing/by-location:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/zones/lookup?lat=...&lng=...
 * Lookup zone information for coordinates
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    if (!lat || !lng) {
      return NextResponse.json(
        { error: 'Missing required parameters: lat and lng' },
        { status: 400 }
      );
    }

    const validation = ZoneLookupQuerySchema.safeParse({ lat, lng });
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid lat/lng parameters', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { lat: latitude, lng: longitude } = validation.data;

    // Resolve area
    const areaId = await resolveAreaFromCoordinates(latitude, longitude);

    // Get area details if found
    let areaDetails = null;
    if (areaId) {
      const area = await prisma.area.findUnique({
        where: { id: areaId },
        select: { id: true, name: true, description: true },
      });
      if (area) {
        areaDetails = {
          id: area.id,
          name: area.name,
          description: area.description,
        };
      }
    }

    const response = {
      coordinates: { lat: latitude, lng: longitude },
      zone: areaDetails,
      is_supported: areaId !== null,
      resolution_method: areaId ? 'polygon_match' : 'none',
      explanation: areaId ? 'Coordinates matched to area polygon' : 'No area found for coordinates',
      cached: false,
      resolved_at: new Date().toISOString(),
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in zones/lookup:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pricing/cache
 * Clear pricing cache (admin endpoint)
 */
export async function DELETE() {
  try {
    priceCache.clear();
    return NextResponse.json({ message: 'Cache cleared successfully' });
  } catch {
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}
