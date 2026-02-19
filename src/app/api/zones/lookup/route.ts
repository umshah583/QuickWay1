// Zone Lookup API Endpoint
// GET /api/zones/lookup?lat=...&lng=...

import { NextRequest, NextResponse } from 'next/server';
import { resolveZone } from '@/lib/zone-resolution';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');

    if (!latParam || !lngParam) {
      return NextResponse.json(
        {
          error: 'Missing required parameters',
          details: 'Both lat and lng parameters are required'
        },
        { status: 400 }
      );
    }

    const lat = parseFloat(latParam);
    const lng = parseFloat(lngParam);

    // Validate coordinates
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        {
          error: 'Invalid coordinates',
          details: 'Latitude must be between -90 and 90, longitude between -180 and 180'
        },
        { status: 400 }
      );
    }

    // Resolve zone
    const zoneResolution = await resolveZone(lat, lng);

    const response = {
      coordinates: {
        lat: lat,
        lng: lng
      },
      zone: zoneResolution.zoneId ? {
        id: zoneResolution.zoneId,
        code: zoneResolution.zoneCode,
        name: zoneResolution.zoneName
      } : null,
      is_supported: zoneResolution.zoneId !== null,
      service_available: zoneResolution.zoneId !== null,
      resolution_method: zoneResolution.source,
      explanation: zoneResolution.explanation,
      cached: zoneResolution.source === 'cache',
      resolved_at: new Date().toISOString(),
      api_version: '1.0'
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in zones lookup API:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
