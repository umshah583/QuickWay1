import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { errorResponse, jsonResponse } from "@/lib/api-response";
import crypto from "crypto";

const schema = z.object({
  email: z.string().email("Invalid email address"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Invalid email address", 400);
    }

    const { email } = parsed.data;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Always return success to prevent email enumeration attacks
    if (!user) {
      return jsonResponse({
        success: true,
        message: "If an account exists with this email, you will receive a password reset link shortly.",
      });
    }

    // Generate secure random token
    const resetToken = crypto.randomBytes(32).toString("hex");
    
    // Token expires in 30 minutes
    const resetExpires = new Date(Date.now() + 30 * 60 * 1000);

    // Save token to database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    // Send reset email
    try {
      await sendPasswordResetEmail(email, resetToken);
    } catch (emailError) {
      console.error("Failed to send password reset email:", emailError);
      // Still return success to user but log the error
    }

    return jsonResponse({
      success: true,
      message: "If an account exists with this email, you will receive a password reset link shortly.",
    });
  } catch (error) {
    console.error("Error requesting password reset:", error);
    return errorResponse("Failed to process request", 500);
  }
}
