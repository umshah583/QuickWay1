import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  try {
    await requireAdminSession();
    
    const formData = await request.formData();
    const driverId = formData.get("driverId") as string;
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phoneNumber = formData.get("phoneNumber") as string;

    if (!driverId) {
      return NextResponse.json({ error: "Driver ID is required" }, { status: 400 });
    }

    // Check if driver exists and is a DRIVER role
    const existingDriver = await prisma.user.findUnique({
      where: { id: driverId },
    });

    if (!existingDriver || existingDriver.role !== "DRIVER") {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== existingDriver.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email },
      });

      if (emailExists) {
        return NextResponse.json({ error: "Email already exists" }, { status: 400 });
      }
    }

    // Update driver
    const updatedDriver = await prisma.user.update({
      where: { id: driverId },
      data: {
        name: name || null,
        email: email || null,
        phoneNumber: phoneNumber || null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, driver: updatedDriver });
  } catch (error) {
    console.error("Error updating driver:", error);
    return NextResponse.json(
      { error: "Failed to update driver" },
      { status: 500 }
    );
  }
}
