import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse } from "@/lib/api-response";
import { sendVerificationEmail } from "@/lib/email";
import crypto from "crypto";

const schema = z.object({
  email: z.string().email(),
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

    if (!user) {
      // Don't reveal if user exists or not for security
      return jsonResponse({
        success: true,
        message: "If an account exists with this email, a verification link has been sent.",
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      return errorResponse("Email is already verified. You can sign in now.", 400);
    }

    // Generate new verification token (expires in 30 minutes)
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = new Date(Date.now() + 30 * 60 * 1000);

    // Update user with new token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
    });

    // Send verification email
    try {
      await sendVerificationEmail(email, verificationToken);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      return errorResponse("Failed to send verification email. Please try again later.", 500);
    }

    return jsonResponse({
      success: true,
      message: "Verification email sent! Please check your inbox.",
    });
  } catch (error) {
    console.error("Error resending verification email:", error);
    return errorResponse("Failed to resend verification email", 500);
  }
}
