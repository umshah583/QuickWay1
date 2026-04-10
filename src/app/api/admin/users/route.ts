import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET - List all users
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch internal users (ADMIN, DRIVER, PARTNER) OR users with a custom role (roleId set)
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { role: { in: ["ADMIN", "DRIVER", "PARTNER"] } },
          { roleId: { not: null } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        role: true,
        roleId: true,
        emailVerified: true,
        phoneVerified: true,
        createdAt: true,
        updatedAt: true,
        Role: {
          select: {
            id: true,
            key: true,
            name: true,
          },
        },
        _count: {
          select: {
            Booking_Booking_userIdToUser: true,
            PackageSubscription_PackageSubscription_userIdToUser: true,
            Booking_Booking_driverIdToUser: true,
            PackageSubscription_PackageSubscription_driverIdToUser: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
