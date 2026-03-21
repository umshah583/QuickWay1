import prisma from "@/lib/prisma";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { jsonResponse, errorResponse } from "@/lib/api-response";
import { TaskStatus } from "@prisma/client";

export async function GET(req: Request) {
  const user = await getMobileUserFromRequest(req);
  if (!user) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    console.log('[Mobile Stats API] Calculating stats for user:', user.sub);

    // Debug: Check all user's bookings first
    const allBookings = await prisma.booking.findMany({
      where: { userId: user.sub },
      select: {
        id: true,
        taskStatus: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10 // Last 10 bookings
    });

    console.log('[Mobile Stats API] All user bookings (last 10):', allBookings.map(b => ({
      id: b.id,
      taskStatus: b.taskStatus,
      status: b.status,
      createdAt: b.createdAt
    })));

    // Get user's completed bookings to calculate stats
    const completedBookings = await prisma.booking.findMany({
      where: {
        userId: user.sub,
        taskStatus: TaskStatus.COMPLETED
      },
      select: {
        id: true,
        couponDiscountCents: true,
        taskStatus: true,
      }
    });

    console.log('[Mobile Stats API] Found completed bookings:', completedBookings.length);
    console.log('[Mobile Stats API] Booking details:', completedBookings.map(b => ({
      id: b.id,
      taskStatus: b.taskStatus,
      discount: b.couponDiscountCents
    })));

    // Get feedbacks for these bookings
    const bookingIds = completedBookings.map(b => b.id);
    const feedbacks = await prisma.feedback.findMany({
      where: {
        bookingId: { in: bookingIds },
        userId: user.sub
      },
      select: {
        rating: true,
        bookingId: true
      }
    });

    console.log('[Mobile Stats API] Found feedbacks:', feedbacks.length);
    console.log('[Mobile Stats API] Feedback details:', feedbacks);

    // Calculate total washes (number of completed bookings)
    const totalWashes = completedBookings.length;

    // Calculate total saved cents (sum of coupon discounts from completed bookings)
    const totalSavedCents = completedBookings.reduce((total, booking) => {
      return total + (booking.couponDiscountCents || 0);
    }, 0);

    // Calculate average rating from feedbacks
    const ratings = feedbacks
      .map(feedback => feedback.rating)
      .filter(rating => rating !== null && rating !== undefined);

    const averageRating = ratings.length > 0
      ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
      : 0;

    return jsonResponse({
      totalWashes,
      totalSavedCents,
      averageRating: Math.round(averageRating * 10) / 10 // Round to 1 decimal
    });

  } catch (error) {
    console.error('[Mobile Stats API] Error fetching user stats:', error);
    return errorResponse("Internal server error", 500);
  }
}
