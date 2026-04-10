import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma, { Prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  phoneNumber: z.string().optional(),
  role: z.string().optional(),
  emailVerified: z.boolean().optional(),
  phoneVerified: z.boolean().optional(),
});

// GET - Get single user
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        role: true,
        roleId: true,
        emailVerified: true,
        phoneVerified: true,
        image: true,
        createdAt: true,
        updatedAt: true,
        loyaltyRedeemedPoints: true,
        loyaltyCreditCents: true,
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
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

// PATCH - Update user
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const updateData: Prisma.UserUpdateInput = {};

    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.email !== undefined) updateData.email = parsed.data.email;
    if (parsed.data.phoneNumber !== undefined)
      updateData.phoneNumber = parsed.data.phoneNumber;
    
    // Handle role update - look up role by key and set appropriately
    if (parsed.data.role !== undefined) {
      const role = await prisma.role.findUnique({
        where: { key: parsed.data.role },
      });
      if (role) {
        // For legacy enum compatibility, use the role key if it's a standard role
        const standardRoles = ['USER', 'ADMIN', 'DRIVER', 'PARTNER'];
        if (standardRoles.includes(role.key.toUpperCase())) {
          // Standard role - set enum value
          (updateData as any).role = role.key.toUpperCase() as Prisma.UserUpdateInput['role'];
        }
        // Always set roleId for the relation
        (updateData as any).roleId = role.id;
      }
    }
    
    if (parsed.data.phoneVerified !== undefined)
      updateData.phoneVerified = parsed.data.phoneVerified;

    // Handle email verification - set to current date if true, null if false
    if (parsed.data.emailVerified !== undefined) {
      updateData.emailVerified = parsed.data.emailVerified ? new Date() : null;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        role: true,
        roleId: true,
        emailVerified: true,
        phoneVerified: true,
        updatedAt: true,
        Role: {
          select: {
            id: true,
            key: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ user, message: "User updated successfully" });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

// DELETE - Delete user
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    // Prevent self-deletion
    if (session.user.id === id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
