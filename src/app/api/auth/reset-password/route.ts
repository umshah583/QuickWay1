import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { errorResponse, jsonResponse } from "@/lib/api-response";

const schema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid input";
      return errorResponse(message, 400);
    }

    const { token, password } = parsed.data;

    // Find user with this reset token
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gte: new Date(), // Token must not be expired
        },
      },
    });

    if (!user) {
      return errorResponse(
        "Invalid or expired reset token. Please request a new password reset.",
        400
      );
    }

    // Hash new password
    const passwordHash = bcrypt.hashSync(password, 10);

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    return jsonResponse({
      success: true,
      message: "Password reset successfully! You can now sign in with your new password.",
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    return errorResponse("Failed to reset password", 500);
  }
}
