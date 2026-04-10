import prisma from "@/lib/prisma";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { errorResponse, jsonResponse } from "@/lib/api-response";

// GET /api/live-tracking - Get current driver locations
// Supports filtering by bookingId or driverId
export async function GET(req: Request) {
  const url = new URL(req.url ?? "http://localhost");
  const bookingId = url.searchParams.get('bookingId');

  const mobileUser = await getMobileUserFromRequest(req);
  let userId: string | null = null;
  let userRole: string | null = null;

  if (mobileUser) {
    userId = mobileUser.sub;
    userRole = mobileUser.role;
  } else {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse("Unauthorized", 401);
    }
    userId = (session.user as { id: string }).id;
    userRole = (session.user as { role: string }).role;
  }

  if (!userId) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    // For customers - only allow tracking their own bookings
    if (userRole === 'USER') {
      if (!bookingId) {
        return errorResponse("bookingId parameter is required for customers", 400);
      }

      // Verify the booking belongs to the customer
      const booking = await prisma.booking.findFirst({
        where: {
          id: bookingId,
          userId: userId,
        },
        select: {
          id: true,
          taskStatus: true,
          driverLatitude: true,
          driverLongitude: true,
          driverLocationUpdatedAt: true,
          User_Booking_driverIdToUser: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!booking) {
        return errorResponse("Booking not found", 404);
      }

      if (booking.taskStatus !== 'IN_PROGRESS') {
        return errorResponse("Tracking is only available while service is in progress", 400);
      }

      return jsonResponse({
        bookingId: booking.id,
        driver: booking.User_Booking_driverIdToUser,
        location: {
          latitude: booking.driverLatitude,
          longitude: booking.driverLongitude,
          updatedAt: booking.driverLocationUpdatedAt,
        },
      });
    }

    // For admins - can track all drivers
    if (userRole === 'ADMIN') {
      if (bookingId) {
        // Track specific booking
        const booking = await prisma.booking.findUnique({
          where: { id: bookingId },
          select: {
            id: true,
            taskStatus: true,
            driverLatitude: true,
            driverLongitude: true,
            driverLocationUpdatedAt: true,
            User_Booking_driverIdToUser: {
              select: {
                id: true,
                name: true,
              },
            },
            User_Booking_userIdToUser: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        if (!booking) {
          return errorResponse("Booking not found", 404);
        }

        return jsonResponse({
          bookingId: booking.id,
          customer: booking.User_Booking_userIdToUser,
          driver: booking.User_Booking_driverIdToUser,
          taskStatus: booking.taskStatus,
          location: {
            latitude: booking.driverLatitude,
            longitude: booking.driverLongitude,
            updatedAt: booking.driverLocationUpdatedAt,
          },
        });
      } else {
        // Show ALL drivers with their locations and availability status
        console.log('[LiveTracking API] Fetching all drivers with location and availability...');
        
        // Get all drivers with their current location from User model
        const allDrivers = await prisma.user.findMany({
          where: {
            role: 'DRIVER',
          },
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            createdAt: true,
            updatedAt: true,
            // Driver location fields stored directly on User
            currentLatitude: true,
            currentLongitude: true,
            locationUpdatedAt: true,
          },
          orderBy: {
            name: 'asc',
          },
        });

        console.log(`[LiveTracking API] Found ${allDrivers.length} total drivers`);

        // Get active bookings with drivers (for current tasks)
        const activeBookings = await prisma.booking.findMany({
          where: {
            taskStatus: { in: ['IN_PROGRESS', 'ASSIGNED'] },
            driverId: { not: null },
          },
          select: {
            id: true,
            taskStatus: true,
            driverId: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        // Get driver day status (for availability)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const driverDays = await prisma.driverDay.findMany({
          where: {
            date: {
              gte: today,
              lt: tomorrow,
            },
          },
          select: {
            driverId: true,
            status: true,
            startedAt: true,
            endedAt: true,
            tasksCompleted: true,
            tasksInProgress: true,
          },
        });

        console.log(`[LiveTracking API] Found ${activeBookings.length} active bookings and ${driverDays.length} driver day records`);

        // Process ALL drivers with their status (not just active ones)
        const driversWithStatus: Array<{
          driverId: string;
          driverName: string;
          phoneNumber: string | null;
          availabilityStatus: 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'ON_BREAK';
          currentTaskStatus: string | null;
          location: {
            latitude: number | null;
            longitude: number | null;
            updatedAt: Date | null;
          } | null;
          lastSeen: Date;
          taskCount: number;
        }> = [];

        for (const driver of allDrivers) {
          // Check if driver has active booking
          const activeBooking = activeBookings.find(b => b.driverId === driver.id);
          
          // Check driver day status
          const driverDay = driverDays.find(d => d.driverId === driver.id);
          
          // Determine availability status
          let availabilityStatus: 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'ON_BREAK' = 'OFFLINE';
          let currentTaskStatus: string | null = null;
          
          if (driverDay) {
            if (driverDay.status === 'OPEN') {
              availabilityStatus = activeBooking ? 'BUSY' : 'AVAILABLE';
              currentTaskStatus = activeBooking?.taskStatus || null;
            } else if (driverDay.status === 'CLOSED') {
              availabilityStatus = 'OFFLINE';
            }
          } else {
            // No driver day record for today - assume offline
            availabilityStatus = 'OFFLINE';
          }

          // Get location from User model (only show drivers with actual GPS coordinates)
          let location = driver.currentLatitude && driver.currentLongitude ? {
            latitude: driver.currentLatitude,
            longitude: driver.currentLongitude,
            updatedAt: driver.locationUpdatedAt,
          } : null;

          // If driver has no location, skip them from the map
          // Only show drivers with actual GPS coordinates from their device
          if (!location) {
            console.log(`[LiveTracking API] Skipping driver ${driver.name} (${driver.id}) - no GPS location`);
            continue; // Skip this driver
          }

          driversWithStatus.push({
            driverId: driver.id,
            driverName: driver.name || 'Unknown Driver',
            phoneNumber: driver.phoneNumber,
            availabilityStatus,
            currentTaskStatus,
            location,
            lastSeen: driver.locationUpdatedAt || driver.updatedAt,
            taskCount: driverDay?.tasksCompleted || 0,
          });
        }

        console.log(`[LiveTracking API] Processed ${driversWithStatus.length} drivers with status`);

        return jsonResponse({
          drivers: driversWithStatus,
          totalDrivers: allDrivers.length,
          availableDrivers: driversWithStatus.filter(d => d.availabilityStatus === 'AVAILABLE').length,
          busyDrivers: driversWithStatus.filter(d => d.availabilityStatus === 'BUSY').length,
          offlineDrivers: driversWithStatus.filter(d => d.availabilityStatus === 'OFFLINE').length,
        });
      }
    }

    return errorResponse("Access denied", 403);
  } catch (error) {
    console.error('[Live Tracking API] Error:', error);
    return errorResponse("Failed to fetch location data", 500);
  }
}

export function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
