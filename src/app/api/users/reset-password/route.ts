import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin-auth";
import { randomBytes } from "crypto";

export async function POST(request: NextRequest) {
  try {
    await requireAdminSession();
    
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.email) {
      return NextResponse.json({ error: "User not found or no email address" }, { status: 404 });
    }

    // Generate password reset token
    const resetToken = randomBytes(32).toString('hex');
    const resetExpires = new Date();
    resetExpires.setHours(resetExpires.getHours() + 1); // Token expires in 1 hour

    // Update user with reset token
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
        updatedAt: new Date(),
      },
    });

    // In a real application, you would send an email here
    // For now, we'll just return the reset link for testing purposes
    const resetLink = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    return NextResponse.json({ 
      success: true, 
      message: "Password reset link generated successfully",
      resetLink: resetLink, // Only for development/testing
      email: user.email
    });
  } catch (error) {
    console.error("Error generating password reset:", error);
    return NextResponse.json(
      { error: "Failed to generate password reset link" },
      { status: 500 }
    );
  }
}
