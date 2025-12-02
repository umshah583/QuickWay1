import prisma from "@/lib/prisma";
import { jsonResponse } from "@/lib/api-response";

// Debug endpoint to check ETA data
export async function GET() {
  const bookings = await prisma.booking.findMany({
    where: {
      taskStatus: "IN_PROGRESS",
    },
    select: {
      id: true,
      taskStatus: true,
      customerLatitude: true,
      customerLongitude: true,
      driverLatitude: true,
      driverLongitude: true,
      userId: true,
      status: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    take: 10,
  });

  return jsonResponse({
    count: bookings.length,
    bookings: bookings.map(b => ({
      id: b.id,
      taskStatus: b.taskStatus,
      status: b.status,
      userName: b.user?.name,
      customerLat: b.customerLatitude,
      customerLon: b.customerLongitude,
      driverLat: b.driverLatitude,
      driverLon: b.driverLongitude,
      hasCustomerGPS: !!(b.customerLatitude && b.customerLongitude),
      hasDriverGPS: !!(b.driverLatitude && b.driverLongitude),
    })),
  });
}
