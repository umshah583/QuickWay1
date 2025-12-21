import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

type RouteContext = { params: Promise<{ id: string }> };

// GET - Get a single customer
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const customer = await prisma.user.findFirst({
      where: { id, role: "USER" },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        emailVerified: true,
        phoneVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            bookings: true,
            packageSubscriptions: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({ customer });
  } catch (error) {
    console.error("Error fetching customer:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer" },
      { status: 500 }
    );
  }
}

// PATCH - Update a customer
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { name, email, phoneNumber, password, emailVerified, phoneVerified } = body;

    // Verify customer exists
    const existing = await prisma.user.findFirst({
      where: { id, role: "USER" },
    });

    if (!existing) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Check for duplicate email
    if (email && email !== existing.email) {
      const emailExists = await prisma.user.findUnique({ where: { email } });
      if (emailExists) {
        return NextResponse.json(
          { error: "A user with this email already exists" },
          { status: 400 }
        );
      }
    }

    // Check for duplicate phone
    if (phoneNumber && phoneNumber !== existing.phoneNumber) {
      const phoneExists = await prisma.user.findFirst({
        where: { phoneNumber, NOT: { id } },
      });
      if (phoneExists) {
        return NextResponse.json(
          { error: "A user with this phone number already exists" },
          { status: 400 }
        );
      }
    }

    const updateData: {
      name?: string;
      email?: string;
      phoneNumber?: string | null;
      passwordHash?: string;
      emailVerified?: Date | null;
      phoneVerified?: boolean;
    } = {};

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber || null;
    if (password) updateData.passwordHash = bcrypt.hashSync(password, 10);
    if (emailVerified !== undefined) {
      updateData.emailVerified = emailVerified ? new Date() : null;
    }
    if (phoneVerified !== undefined) updateData.phoneVerified = phoneVerified;

    const customer = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        emailVerified: true,
        phoneVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ customer, message: "Customer updated successfully" });
  } catch (error) {
    console.error("Error updating customer:", error);
    return NextResponse.json(
      { error: "Failed to update customer" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a customer
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    // Verify customer exists
    const existing = await prisma.user.findFirst({
      where: { id, role: "USER" },
    });

    if (!existing) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Check if customer has bookings
    const bookingCount = await prisma.booking.count({
      where: { userId: id },
    });

    if (bookingCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete customer with ${bookingCount} existing bookings. Consider deactivating instead.` },
        { status: 400 }
      );
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ message: "Customer deleted successfully" });
  } catch (error) {
    console.error("Error deleting customer:", error);
    return NextResponse.json(
      { error: "Failed to delete customer" },
      { status: 500 }
    );
  }
}
