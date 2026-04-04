// Reverse Geocoding API Endpoint
// GET /api/driver/reverse-geocode?lat=...&lng=...

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

interface LocationInfo {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  zone?: {
    id: string;
    name: string;
  };
  area?: string;
  city?: string;
  country?: string;
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

/**
 * Generate a readable address from coordinates and zone information
 */
function generateFormattedAddress(lat: number, lng: number, zone?: { id: string; name: string }): string {
  if (zone) {
    return zone.name;
  }
  
  // Fallback to a more readable coordinate format
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`;
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
    
    if (!lat || !lng) {
      return errorResponse('Latitude and longitude are required', 400);
    }

    // Validate coordinates
    const validation = QuerySchema.safeParse({ lat, lng });
    if (!validation.success) {
      return errorResponse('Invalid coordinates', 400);
    }

    const { lat: latitude, lng: longitude } = validation.data;
    console.log(`[Reverse Geocode] Driver ${session.sub} requesting location name for: ${latitude}, ${longitude}`);

    // Find zone for location
    const zone = await findZoneForLocation(latitude, longitude);
    
    // Generate formatted address
    const formattedAddress = generateFormattedAddress(latitude, longitude, zone || undefined);

    const locationInfo: LocationInfo = {
      latitude,
      longitude,
      formattedAddress,
      zone: zone ? {
        id: zone.id,
        name: zone.name,
      } : undefined,
    };

    console.log(`[Reverse Geocode] Location: ${formattedAddress} (Zone: ${zone?.name || 'None'})`);

    return jsonResponse({
      location: locationInfo,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error in reverse geocode API:', error);
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return errorResponse('Unauthorized', 401);
    }

    return errorResponse('Internal server error', 500);
  }
}
