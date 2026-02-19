// GPS-Based Zone Resolution Service
// Node.js/TypeScript implementation with PostGIS and fallback algorithms

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Cache interface
interface ZoneCache {
  [key: string]: {
    zoneId: string | null;
    expiresAt: Date;
    hitCount: number;
  };
}

// In-memory cache (in production, use Redis)
const zoneCache: ZoneCache = {};
const CACHE_TTL_MINUTES = 5;
const CACHE_PRECISION = 4; // Round to 4 decimals (~11m precision)

/**
 * Generate cache key from lat/lng coordinates
 */
function generateCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(CACHE_PRECISION)}_${lng.toFixed(CACHE_PRECISION)}`;
}

/**
 * Clear expired cache entries
 */
function cleanupCache(): void {
  const now = new Date();
  Object.keys(zoneCache).forEach(key => {
    if (zoneCache[key].expiresAt < now) {
      delete zoneCache[key];
    }
  });
}

/**
 * Point-in-Polygon algorithm (fallback when PostGIS not available)
 * Uses ray casting algorithm
 */
function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Convert GeoJSON polygon to coordinate array
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function geoJsonToCoords(polygonJson: any): [number, number][] {
  if (!polygonJson || !polygonJson.coordinates || !polygonJson.coordinates[0]) {
    return [];
  }

  // GeoJSON format: [[[lng, lat], [lng, lat], ...]]
  return polygonJson.coordinates[0].map((coord: [number, number]) => [coord[1], coord[0]]); // Swap to [lat, lng]
}

/**
 * Fallback zone resolution using point-in-polygon algorithm
 */
async function resolveZoneFallback(lat: number, lng: number): Promise<string | null> {
  try {
    const zones = await prisma.$queryRaw<Array<{
      id: string;
      code: string;
      name: string;
      priority: number;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      polygon_json: any;
      updated_at: Date;
    }>>`
      SELECT id, code, name, priority, polygon_json, updated_at
      FROM zones
      WHERE is_active = true
      ORDER BY priority DESC, updated_at DESC
    `;

    const point: [number, number] = [lat, lng];

    for (const zone of zones) {
      if (zone.polygon_json) {
        const coords = geoJsonToCoords(zone.polygon_json);
        if (coords.length > 0 && isPointInPolygon(point, coords)) {
          return zone.id;
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error in fallback zone resolution:', error);
    return null;
  }
}

/**
 * PostGIS-based zone resolution (preferred method)
 */
async function resolveZonePostGIS(lat: number, lng: number): Promise<string | null> {
  try {
    const result = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM zones
      WHERE is_active = true
        AND ST_Contains(polygon, ST_SetSRID(ST_Point(${lng}, ${lat}), 4326))
      ORDER BY priority DESC, updated_at DESC
      LIMIT 1
    `;

    return result.length > 0 ? result[0].id : null;
  } catch (error) {
    console.error('PostGIS query failed, falling back to algorithm:', error);
    return resolveZoneFallback(lat, lng);
  }
}

/**
 * Main zone resolution function with caching
 */
export async function resolveZone(lat: number, lng: number): Promise<{
  zoneId: string | null;
  zoneCode?: string;
  zoneName?: string;
  source: 'cache' | 'postgis' | 'fallback';
  explanation: string;
}> {
  // Input validation
  if (typeof lat !== 'number' || typeof lng !== 'number' ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('Invalid latitude or longitude coordinates');
  }

  const cacheKey = generateCacheKey(lat, lng);

  // Check cache first
  if (zoneCache[cacheKey] && zoneCache[cacheKey].expiresAt > new Date()) {
    zoneCache[cacheKey].hitCount++;
    return {
      zoneId: zoneCache[cacheKey].zoneId,
      source: 'cache',
      explanation: `Resolved from cache (hit #${zoneCache[cacheKey].hitCount})`
    };
  }

  // Clean up expired cache entries periodically
  if (Math.random() < 0.01) { // 1% chance
    cleanupCache();
  }

  let zoneId: string | null = null;
  let source: 'postgis' | 'fallback' = 'postgis';
  let explanation = '';

  try {
    // Try PostGIS first
    zoneId = await resolveZonePostGIS(lat, lng);
    if (zoneId) {
      explanation = 'Resolved using PostGIS ST_Contains';
    } else {
      // Try fallback if no zone found
      zoneId = await resolveZoneFallback(lat, lng);
      source = 'fallback';
      explanation = zoneId ? 'Resolved using point-in-polygon algorithm' : 'No zone found for coordinates';
    }
  } catch {
    // Fallback to algorithm
    zoneId = await resolveZoneFallback(lat, lng);
    source = 'fallback';
    explanation = zoneId ? 'Resolved using point-in-polygon algorithm (PostGIS failed)' : 'No zone found for coordinates';
  }

  // Cache the result
  zoneCache[cacheKey] = {
    zoneId,
    expiresAt: new Date(Date.now() + CACHE_TTL_MINUTES * 60 * 1000),
    hitCount: 1
  };

  // Get zone details if found
  let zoneCode: string | undefined;
  let zoneName: string | undefined;

  if (zoneId) {
    try {
      const zones = await prisma.$queryRaw<Array<{ code: string; name: string }>>`
        SELECT code, name FROM zones WHERE id = ${zoneId} LIMIT 1
      `;
      if (zones.length > 0) {
        zoneCode = zones[0].code;
        zoneName = zones[0].name;
      }
    } catch (error) {
      console.error('Error fetching zone details:', error);
    }
  }

  return {
    zoneId,
    zoneCode,
    zoneName,
    source,
    explanation
  };
}

/**
 * Get zone by ID with full details
 */
export async function getZoneById(zoneId: string) {
  const zones = await prisma.$queryRaw<Array<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    priority: number;
    area_sqm: number | null;
    center_lat: number | null;
    center_lng: number | null;
    metadata: unknown;
  }>>`
    SELECT id, code, name, description, priority, area_sqm, center_lat, center_lng, metadata
    FROM zones WHERE id = ${zoneId} LIMIT 1
  `;
  return zones.length > 0 ? zones[0] : null;
}

/**
 * Test zone resolution with sample coordinates
 */
export async function testZoneResolution(testPoints: Array<{ lat: number; lng: number; expectedZone?: string }>) {
  const results = [];

  for (const point of testPoints) {
    try {
      const result = await resolveZone(point.lat, point.lng);
      results.push({
        input: point,
        result,
        match: point.expectedZone ? result.zoneId === point.expectedZone : null
      });
    } catch (error) {
      results.push({
        input: point,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return results;
}
