# Driver Mobile App API Endpoints

New API endpoints created for the driver mobile application.

## Authentication

### POST `/api/driver/login`
Authenticates a driver and returns a JWT token.

**Request Body:**
```json
{
  "email": "driver@example.com",
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "driver": {
    "id": "driver-uuid",
    "email": "driver@example.com",
    "name": "Driver Name"
  }
}
```

**Error Responses:**
- `400` - Invalid input
- `401` - Invalid email or password
- `403` - Account not authorized for driver app (not a DRIVER role)

---

### POST `/api/driver/logout`
Logs out the driver (client-side token deletion).

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## Dashboard

### GET `/api/driver/dashboard`
Fetches all dashboard data including bookings and KPIs.

**Headers:**
```
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "data": {
    "assignmentBookings": [...],
    "cashBookings": [...],
    "totalJobs": 5,
    "activeJobs": 3,
    "totalValueCents": 50000,
    "collectedCents": 30000,
    "pendingCents": 20000,
    "collectedCount": 2,
    "showAssignmentsEmpty": false,
    "showCashEmpty": false
  },
  "featureFlags": {
    "driverTabOverview": true,
    "driverTabAssignments": true,
    "driverTabCash": true
  }
}
```

**Error Responses:**
- `401` - Unauthorized (no token or invalid token)

---

## Task Actions

### POST `/api/driver/start-task`
Starts a task (changes status to IN_PROGRESS).

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "bookingId": "booking-uuid"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Task started successfully"
}
```

**Error Responses:**
- `400` - Missing bookingId
- `401` - Unauthorized
- `403` - Booking not assigned to this driver

---

### POST `/api/driver/complete-task`
Completes a task (changes status to COMPLETED).

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "bookingId": "booking-uuid"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Task completed successfully"
}
```

**Error Responses:**
- `400` - Missing bookingId or cash not collected for cash bookings
- `401` - Unauthorized
- `403` - Booking not assigned to this driver

---

### POST `/api/driver/submit-cash`
Submits cash collection details.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "bookingId": "booking-uuid",
  "cashCollected": true,
  "cashAmount": 150.50,
  "driverNotes": "Customer paid exact amount"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Cash details saved successfully"
}
```

**Error Responses:**
- `400` - Invalid input or unable to determine booking amount
- `401` - Unauthorized
- `403` - Booking not assigned to this driver

---

## Implementation Details

### Authentication Flow
1. Mobile app sends credentials to `/api/driver/login`
2. Server validates credentials and checks for DRIVER role
3. Server generates JWT token using `signMobileToken()` from `@/lib/mobile-session`
4. Token is valid for 7 days
5. Mobile app stores token in AsyncStorage
6. Token is sent in `Authorization: Bearer <token>` header for all subsequent requests

### Authorization
- All protected endpoints use `getMobileUserFromRequest()` to verify the JWT token
- Only users with `role: "DRIVER"` can access driver endpoints
- Each action verifies that the booking is assigned to the authenticated driver

### CORS Support
- All endpoints include CORS headers via `jsonResponse()` and `noContentResponse()`
- Configured for mobile app access
- OPTIONS handlers included for preflight requests

### Notifications & Live Updates
- Task actions trigger push notifications to customers
- Admin notifications are recorded for task events
- Live updates are published for real-time UI updates

### Data Synchronization
- Dashboard data matches exactly what the web driver dashboard shows
- Uses the same Prisma queries and business logic
- Feature flags control which tabs/features are available

---

## Testing

### Using curl:

**Login:**
```bash
curl -X POST https://quick-way1.vercel.app/api/driver/login \
  -H "Content-Type: application/json" \
  -d '{"email":"driver@example.com","password":"password123"}'
```

**Get Dashboard:**
```bash
curl -X GET https://quick-way1.vercel.app/api/driver/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Start Task:**
```bash
curl -X POST https://quick-way1.vercel.app/api/driver/start-task \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"bookingId":"booking-id-here"}'
```

---

## Files Created

- `/src/app/api/driver/login/route.ts` - Login endpoint
- `/src/app/api/driver/logout/route.ts` - Logout endpoint
- `/src/app/api/driver/dashboard/route.ts` - Dashboard data endpoint
- `/src/app/api/driver/start-task/route.ts` - Start task action
- `/src/app/api/driver/complete-task/route.ts` - Complete task action
- `/src/app/api/driver/submit-cash/route.ts` - Submit cash details

All endpoints follow Next.js App Router conventions and use existing utilities from the web application.
