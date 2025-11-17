import { z } from "zod";
import bcrypt from "bcryptjs";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import prisma from "@/lib/prisma";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

export async function OPTIONS() {
  return noContentResponse("POST,OPTIONS");
}

export async function POST(req: Request) {
  const user = await getMobileUserFromRequest(req);
  if (!user) {
    return errorResponse("Unauthorized", 401);
  }

  const body = await req.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return errorResponse(message, 400);
  }

  const { currentPassword, newPassword } = parsed.data;

  // Fetch user with password
  const dbUser = await prisma.user.findUnique({
    where: { id: user.sub },
    select: {
      id: true,
      passwordHash: true,
    },
  });

  if (!dbUser || !dbUser.passwordHash) {
    return errorResponse("User not found or password not set", 404);
  }

  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, dbUser.passwordHash);
  if (!isValid) {
    return errorResponse("Current password is incorrect", 400);
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password
  await prisma.user.update({
    where: { id: user.sub },
    data: { passwordHash: hashedPassword },
  });

  return jsonResponse({ message: "Password updated successfully" });
}
