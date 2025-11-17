import { z } from "zod";
import { jsonResponse, errorResponse, noContentResponse } from "@/lib/api-response";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import prisma from "@/lib/prisma";

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phoneNumber: z.string().trim().nullable().optional(),
});

export async function OPTIONS() {
  return noContentResponse("GET,PUT,OPTIONS");
}

export async function GET(req: Request) {
  const user = await getMobileUserFromRequest(req);
  if (!user) {
    return errorResponse("Unauthorized", 401);
  }

  const profile = await prisma.user.findUnique({
    where: { id: user.sub },
    select: {
      id: true,
      email: true,
      name: true,
      phoneNumber: true,
    },
  });

  if (!profile) {
    return errorResponse("User not found", 404);
  }

  return jsonResponse({
    id: profile.id,
    email: profile.email,
    name: profile.name,
    phoneNumber: profile.phoneNumber,
  });
}

export async function PUT(req: Request) {
  const user = await getMobileUserFromRequest(req);
  if (!user) {
    return errorResponse("Unauthorized", 401);
  }

  const body = await req.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return errorResponse(message, 400);
  }

  const { name, email, phoneNumber } = parsed.data;

  // Check if email is already taken by another user
  if (email !== undefined && email !== null) {
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        id: { not: user.sub },
      },
    });

    if (existingUser) {
      return errorResponse("Email already in use", 400);
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.sub },
    data: {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(phoneNumber !== undefined && { phoneNumber }),
    },
    select: {
      id: true,
      email: true,
      name: true,
      phoneNumber: true,
    },
  });

  return jsonResponse({
    id: updatedUser.id,
    email: updatedUser.email,
    name: updatedUser.name,
    phoneNumber: updatedUser.phoneNumber,
  });
}
