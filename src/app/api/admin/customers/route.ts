import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendVerificationEmail } from "@/lib/email";
import crypto from "crypto";

// GET - List all customers (USER role only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const customers = await prisma.user.findMany({
      where: { role: "USER" },
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
            Booking_Booking_userIdToUser: true,
            PackageSubscription_PackageSubscription_userIdToUser: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ customers });
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 }
    );
  }
}

// POST - Create a new customer
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, email, phoneNumber, password } = body;

    if (!email && !phoneNumber) {
      return NextResponse.json(
        { error: "Email or phone number is required" },
        { status: 400 }
      );
    }

    // Check if user with email or phone already exists
    if (email) {
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail) {
        return NextResponse.json(
          { error: "A user with this email already exists" },
          { status: 400 }
        );
      }
    }

    if (phoneNumber) {
      const existingPhone = await prisma.user.findFirst({
        where: { phoneNumber },
      });
      if (existingPhone) {
        return NextResponse.json(
          { error: "A user with this phone number already exists" },
          { status: 400 }
        );
      }
    }

    const customerData: {
      name?: string;
      email?: string;
      phoneNumber?: string;
      role: "USER";
      passwordHash?: string;
      emailVerificationToken?: string;
      emailVerificationExpires?: Date;
    } = {
      role: "USER",
    };

    let verificationToken: string | undefined;
    let verificationExpires: Date | undefined;

    if (name) customerData.name = name;
    if (email) {
      customerData.email = email;
      // Generate verification token (expires in 30 minutes)
      verificationToken = crypto.randomBytes(32).toString("hex");
      verificationExpires = new Date(Date.now() + 30 * 60 * 1000);
      customerData.emailVerificationToken = verificationToken;
      customerData.emailVerificationExpires = verificationExpires;
    }
    if (phoneNumber) customerData.phoneNumber = phoneNumber;
    if (password) {
      customerData.passwordHash = bcrypt.hashSync(password, 10);
    }

    const customer = await prisma.user.create({
      data: customerData as any,
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    // Send verification email if email was provided
    if (email && verificationToken) {
      try {
        await sendVerificationEmail(email, verificationToken);
      } catch (emailError) {
        console.error("Failed to send verification email to customer:", emailError);
        // Customer is still created, they can request a new verification email later
      }
    }

    return NextResponse.json({ customer, message: "Customer created successfully! Verification email sent." });
  } catch (error) {
    console.error("Error creating customer:", error);
    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500 }
    );
  }
}
