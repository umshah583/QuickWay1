# Mobile App Zone Pricing - Integration Fixed

## What Was Fixed

### 1. Services API Now Supports Zone Pricing

**Endpoint:** `GET /api/service-types/{typeId}/services?lat={latitude}&lng={longitude}`

The services API now accepts GPS coordinates as query parameters and automatically returns zone-specific prices.

**Before:**
```typescript
// Only returned base prices
GET /api/service-types/car-wash/services
```

**After:**
```typescript
// Returns zone-specific prices based on GPS location
GET /api/service-types/car-wash/services?lat=25.2048&lng=55.2708
```

**Response includes zone information:**
```json
{
  "data": [
    {
      "id": "service-id",
      "name": "Premium Wash",
      "priceCents": 15000,
      "discountPercentage": 10,
      "adjustedBasePriceCents": 15750,
      "adjustedFinalPriceCents": 14175,
      "areaId": "area-id",
      "areaName": "Dubai Marina"
    }
  ]
}
```

### 2. How Mobile App Should Use It

**Step 1: Get user's GPS location**
```typescript
const location = await getCurrentLocation();
// { latitude: 25.2048, longitude: 55.2708 }
```

**Step 2: Fetch services with location**
```typescript
const response = await fetch(
  `${API_BASE}/api/service-types/car-wash/services?lat=${location.latitude}&lng=${location.longitude}`
);
const { data: services } = await response.json();
```

**Step 3: Display zone-specific prices**
```typescript
services.forEach(service => {
  console.log(`${service.name}: ${service.adjustedFinalPriceCents / 100} AED`);
  if (service.areaName) {
    console.log(`Zone: ${service.areaName}`);
  }
});
```

## Mobile App Changes Needed

### Option 1: Update Existing Service Fetch (Recommended)

Find where your mobile app fetches services and add GPS coordinates:

```typescript
// BEFORE
const fetchServices = async (serviceTypeId: string) => {
  const response = await fetch(`${API_BASE}/api/service-types/${serviceTypeId}/services`);
  return response.json();
};

// AFTER
const fetchServices = async (serviceTypeId: string, location?: {lat: number, lng: number}) => {
  let url = `${API_BASE}/api/service-types/${serviceTypeId}/services`;
  
  if (location) {
    url += `?lat=${location.lat}&lng=${location.lng}`;
  }
  
  const response = await fetch(url);
  return response.json();
};
```

### Option 2: Use Dedicated Pricing Endpoint

If you need more control or want to fetch prices separately:

```typescript
const fetchZonePricing = async (serviceIds: string[], location: {lat: number, lng: number}) => {
  const response = await fetch(`${API_BASE}/api/pricing/by-location`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lat: location.lat,
      lng: location.lng,
      service_ids: serviceIds
    })
  });
  return response.json();
};
```

## Testing

### 1. Test Services API with Coordinates

```bash
# Without coordinates (base prices)
curl "http://localhost:3000/api/service-types/car-wash/services"

# With coordinates (zone prices)
curl "http://localhost:3000/api/service-types/car-wash/services?lat=25.2048&lng=55.2708"
```

### 2. Verify Zone Prices Are Different

1. Create a zone in admin panel
2. Draw polygon on zone detail page
3. Set zone-specific prices (different from base prices)
4. Call API with coordinates inside the polygon
5. Verify `priceCents` matches zone price, not base price

### 3. Check Response Fields

The response should include:
- ✅ `priceCents` - Zone-specific price (or base if no zone)
- ✅ `discountPercentage` - Zone-specific discount (or base if no zone)
- ✅ `areaId` - Zone ID if coordinates matched a zone
- ✅ `areaName` - Zone name if coordinates matched a zone
- ✅ `adjustedBasePriceCents` - Price with VAT and fees
- ✅ `adjustedFinalPriceCents` - Final price after discount, VAT, and fees

## How It Works

1. **Mobile app sends GPS coordinates** as query params to services API
2. **Backend checks if coordinates fall inside any zone polygon**
3. **If zone found, checks for zone-specific price** in `ServiceAreaPrice` table
4. **Returns zone price if available**, otherwise returns base service price
5. **Mobile app displays the correct price** for user's location

## Benefits

- ✅ **Automatic zone detection** - No need to manually select zones
- ✅ **Real-time pricing** - Prices update as user moves between zones
- ✅ **Fallback to base prices** - Works even if no zone is configured
- ✅ **Backward compatible** - Works without coordinates (returns base prices)
- ✅ **Single API call** - No need for separate zone lookup

## Summary

**What changed:**
- Services API now accepts `?lat={lat}&lng={lng}` query parameters
- Returns zone-specific prices automatically
- Includes zone information in response

**What mobile app needs to do:**
- Add GPS coordinates to services API calls
- Display the returned prices (already zone-specific)
- Optionally show zone name to user

**No breaking changes:**
- API works without coordinates (returns base prices)
- Existing mobile app code continues to work
- Just add coordinates to get zone pricing
