import prisma from "@/lib/prisma";
import type { Area, ServiceAreaPrice } from "@prisma/client";

export type ResolvedArea = {
  area: Area;
  servicePrice: ServiceAreaPrice | null;
};

export type AreaPricingResult = {
  areaId: string;
  areaName: string;
  priceCents: number;
  discountPercentage: number | null;
  priceMultiplier: number;
};

/**
 * Check if a point (lat, lng) is within an area's bounding box
 */
function isPointInBoundingBox(
  latitude: number,
  longitude: number,
  area: Area
): boolean {
  return (
    latitude >= area.minLatitude &&
    latitude <= area.maxLatitude &&
    longitude >= area.minLongitude &&
    longitude <= area.maxLongitude
  );
}

/**
 * Point-in-Polygon algorithm for checking if coordinates are inside a polygon
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
 * Check if a point is within an area's polygon (if available) or bounding box
 */
function isPointInArea(
  latitude: number,
  longitude: number,
  area: Area
): boolean {
  // First check bounding box for quick rejection
  if (!isPointInBoundingBox(latitude, longitude, area)) {
    return false;
  }

  // If polygon is available, use precise polygon matching
  if (area.polygonJson) {
    try {
      const polygon = JSON.parse(area.polygonJson);
      
      if (polygon.type === 'Polygon' && Array.isArray(polygon.coordinates) && polygon.coordinates[0]) {
        // GeoJSON uses [lng, lat] format, convert to [lat, lng] for our algorithm
        const coords: [number, number][] = polygon.coordinates[0].map(
          ([lng, lat]: [number, number]) => [lat, lng]
        );

        return isPointInPolygon([latitude, longitude], coords);
      }
    } catch (error) {
      console.error(`[area-resolver] Failed to parse polygon for area ${area.id}:`, error);
      // Fall back to bounding box if polygon parsing fails
    }
  }

  // If no polygon or parsing failed, bounding box check already passed
  return true;
}

/**
 * Resolve which area a GPS coordinate falls into.
 * Returns the first matching active area (sorted by sortOrder).
 */
export async function resolveAreaFromCoordinates(
  latitude: number,
  longitude: number
): Promise<Area | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    console.log("[area-resolver] Invalid coordinates:", { latitude, longitude });
    return null;
  }

  const areas = await prisma.area.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });

  console.log(`[area-resolver] Checking ${areas.length} active areas for coordinates (${latitude}, ${longitude})`);
  
  // Log area details for debugging
  areas.forEach((area, idx) => {
    console.log(`[area-resolver] Area ${idx + 1}: ${area.name} (id: ${area.id})`, {
      bounds: {
        minLat: area.minLatitude,
        maxLat: area.maxLatitude,
        minLng: area.minLongitude,
        maxLng: area.maxLongitude,
      },
      hasPolygon: !!area.polygonJson,
      priceMultiplier: area.priceMultiplier,
    });
  });

  for (const area of areas) {
    const inBoundingBox = isPointInBoundingBox(latitude, longitude, area);
    console.log(`[area-resolver] Checking area ${area.name}: inBoundingBox=${inBoundingBox}`);
    
    if (isPointInArea(latitude, longitude, area)) {
      console.log(`[area-resolver] ✓ Found matching area: ${area.name} (${area.id})`);
      return area;
    }
  }

  console.log("[area-resolver] ✗ No matching area found for coordinates");
  return null;
}

/**
 * Get the service price for a specific area.
 * Returns the ServiceAreaPrice if it exists, null otherwise.
 */
export async function getServiceAreaPrice(
  serviceId: string,
  areaId: string
): Promise<ServiceAreaPrice | null> {
  const areaPrice = await prisma.serviceAreaPrice.findUnique({
    where: {
      serviceId_areaId: {
        serviceId,
        areaId,
      },
    },
  });

  return areaPrice?.active ? areaPrice : null;
}

/**
 * Resolve area pricing for a service based on GPS coordinates.
 * Returns area info and pricing if found, null if no area or no specific price.
 */
export async function resolveAreaPricing(
  serviceId: string,
  latitude: number,
  longitude: number,
  fallbackPriceCents: number,
  fallbackDiscountPercentage: number | null
): Promise<AreaPricingResult | null> {
  const area = await resolveAreaFromCoordinates(latitude, longitude);
  
  if (!area) {
    return null;
  }

  // Try to get area-specific price for this service
  const areaPrice = await getServiceAreaPrice(serviceId, area.id);

  if (areaPrice) {
    // Use area-specific price
    console.log(`[area-resolver] Using area-specific price for service ${serviceId} in area ${area.name}: ${areaPrice.priceCents} cents`);
    return {
      areaId: area.id,
      areaName: area.name,
      priceCents: areaPrice.priceCents,
      discountPercentage: areaPrice.discountPercentage,
      priceMultiplier: area.priceMultiplier,
    };
  }

  // No area-specific price, apply multiplier to fallback price
  if (area.priceMultiplier !== 1.0) {
    const adjustedPrice = Math.round(fallbackPriceCents * area.priceMultiplier);
    console.log(`[area-resolver] Using multiplier ${area.priceMultiplier}x for area ${area.name}: ${fallbackPriceCents} -> ${adjustedPrice} cents`);
    return {
      areaId: area.id,
      areaName: area.name,
      priceCents: adjustedPrice,
      discountPercentage: fallbackDiscountPercentage,
      priceMultiplier: area.priceMultiplier,
    };
  }

  // Area found but no price override and multiplier is 1.0, use fallback
  console.log(`[area-resolver] Area ${area.name} found but using default pricing`);
  return {
    areaId: area.id,
    areaName: area.name,
    priceCents: fallbackPriceCents,
    discountPercentage: fallbackDiscountPercentage,
    priceMultiplier: 1.0,
  };
}

/**
 * Get all areas with their service prices for admin display.
 */
export async function getAllAreasWithPrices(serviceId?: string) {
  const areas = await prisma.area.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: {
      servicePrices: serviceId
        ? {
            where: { serviceId, active: true },
          }
        : {
            where: { active: true },
          },
    },
  });

  return areas;
}

/**
 * Set or update the price for a service in a specific area.
 */
export async function setServiceAreaPrice(
  serviceId: string,
  areaId: string,
  priceCents: number,
  discountPercentage?: number | null
): Promise<ServiceAreaPrice> {
  return prisma.serviceAreaPrice.upsert({
    where: {
      serviceId_areaId: {
        serviceId,
        areaId,
      },
    },
    create: {
      serviceId,
      areaId,
      priceCents,
      discountPercentage: discountPercentage ?? null,
      active: true,
    },
    update: {
      priceCents,
      discountPercentage: discountPercentage ?? null,
      active: true,
    },
  });
}

/**
 * Delete the price for a service in a specific area.
 */
export async function deleteServiceAreaPrice(
  serviceId: string,
  areaId: string
): Promise<void> {
  await prisma.serviceAreaPrice.deleteMany({
    where: {
      serviceId,
      areaId,
    },
  });
}
