import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse } from "@/lib/api-response";

const schema = z.object({
  token: z.string().min(1, "Verification token is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Invalid token", 400);
    }

    const { token } = parsed.data;

    // Find user with this verification token
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: {
          gte: new Date(), // Token must not be expired
        },
      },
    });

    if (!user) {
      return errorResponse(
        "Invalid or expired verification token. Please request a new verification email.",
        400
      );
    }

    // Mark email as verified and clear the token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    return jsonResponse({
      success: true,
      message: "Email verified successfully! You can now sign in.",
    });
  } catch (error) {
    console.error("Error verifying email:", error);
    return errorResponse("Failed to verify email", 500);
  }
}
