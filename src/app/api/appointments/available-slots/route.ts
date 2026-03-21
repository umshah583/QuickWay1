import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Get query parameters
    const date = searchParams.get('date'); // ISO date string (YYYY-MM-DD)
    const serviceId = searchParams.get('serviceId');

    if (!date || !serviceId) {
      return NextResponse.json(
        { error: "Missing required parameters: date and serviceId" },
        { status: 400 }
      );
    }

    // Parse the date
    const requestedDate = new Date(date + 'T00:00:00.000Z');
    if (Number.isNaN(requestedDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    // Get service details to understand duration
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, durationMin: true },
    });

    if (!service) {
      return NextResponse.json(
        { error: "Service not found" },
        { status: 404 }
      );
    }

    // Get business hours
    const businessHours = await prisma.businessHours.findFirst({
      where: { isActive: true },
    });

    if (!businessHours) {
      return NextResponse.json(
        { error: "Business hours not configured" },
        { status: 400 }
      );
    }

    // Parse business hours (format: "HH:MM")
    const [startHour, startMinute] = businessHours.startTime.split(':').map(Number);
    const [endHour, endMinute] = businessHours.endTime.split(':').map(Number);

    // Get existing bookings for this date to determine unavailable slots
    const startOfDay = new Date(requestedDate);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(requestedDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Get all bookings for this date
    const existingBookings = await prisma.booking.findMany({
      where: {
        startAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          in: ['ASSIGNED', 'PENDING', 'PAID'],
        },
      },
      select: {
        startAt: true,
        serviceId: true,
      },
    });

    // Generate time slots based on business hours
    const timeSlots = [];
    const slotDuration = 30; // minutes (30 minute slots)
    const maxBookingsPerSlot = 4; // Allow up to 4 bookings per time slot

    // Start from business start time
    let currentHour = startHour;
    let currentMinute = startMinute;

    while (currentHour < endHour || (currentHour === endHour && currentMinute < endMinute)) {
      const slotStart = new Date(requestedDate);
      slotStart.setHours(currentHour, currentMinute, 0, 0);

      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);

      // Make sure slot doesn't exceed business end time
      if (slotEnd.getUTCHours() > endHour || 
          (slotEnd.getUTCHours() === endHour && slotEnd.getUTCMinutes() > endMinute)) {
        break;
      }

      // Count overlapping bookings for this time slot
      const overlappingBookings = existingBookings.filter(booking => {
        const bookingStart = new Date(booking.startAt);
        const bookingEnd = new Date(bookingStart);
        bookingEnd.setMinutes(bookingEnd.getMinutes() + (service.durationMin || 60));

        // Check for overlap
        return (
          (slotStart >= bookingStart && slotStart < bookingEnd) ||
          (slotEnd > bookingStart && slotEnd <= bookingEnd) ||
          (slotStart <= bookingStart && slotEnd >= bookingEnd)
        );
      });

      const bookedCount = overlappingBookings.length;
      const isFull = bookedCount >= maxBookingsPerSlot;

      const slotId = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
      const hour12 = currentHour === 0 ? 12 : currentHour > 12 ? currentHour - 12 : currentHour;
      const period = currentHour >= 12 ? 'PM' : 'AM';
      const label = `${hour12}:${currentMinute.toString().padStart(2, '0')} ${period}`;

      timeSlots.push({
        id: slotId,
        label,
        hour: currentHour,
        minute: currentMinute,
        status: isFull ? 'full' : 'available',
        capacity: maxBookingsPerSlot,
        booked: bookedCount,
        startAtISO: slotStart.toISOString(),
      });

      // Move to next slot
      currentHour += Math.floor(slotDuration / 60);
      currentMinute += (slotDuration % 60);
      if (currentMinute >= 60) {
        currentHour += Math.floor(currentMinute / 60);
        currentMinute = currentMinute % 60;
      }
    }

    console.log(`[Available Slots API] Business hours: ${businessHours.startTime} - ${businessHours.endTime}, Generated ${timeSlots.length} slots for ${date}, service ${serviceId}`);

    return NextResponse.json({
      data: timeSlots,
      date,
      serviceId,
      businessHours: {
        startTime: businessHours.startTime,
        endTime: businessHours.endTime,
        durationHours: businessHours.durationHours,
      },
    });
  } catch (error) {
    console.error("[GET /api/appointments/available-slots] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch available slots" },
      { status: 500 }
    );
  }
}
