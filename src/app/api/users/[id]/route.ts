import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin-auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminSession();
    const { id } = await params;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user has bookings
    const bookingCount = await prisma.booking.count({
      where: { userId: id },
    });

    if (bookingCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete user with existing bookings. Please delete or reassign bookings first." },
        { status: 400 }
      );
    }

    // Check if user is a driver with assigned bookings
    if (user.role === "DRIVER") {
      const driverBookingCount = await prisma.booking.count({
        where: { driverId: id },
      });

      if (driverBookingCount > 0) {
        return NextResponse.json(
          { error: "Cannot delete driver with assigned bookings. Please reassign bookings first." },
          { status: 400 }
        );
      }
    }

    // Delete the user
    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
