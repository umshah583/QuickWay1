import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";
import { signMobileToken } from "@/lib/mobile-session";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    return errorResponse("Invalid email or password", 401);
  }

  const valid = bcrypt.compareSync(password, user.passwordHash);
  if (!valid) {
    return errorResponse("Invalid email or password", 401);
  }

  // Check if user is a driver
  if (user.role !== "DRIVER") {
    return errorResponse("Account not authorized for driver app", 403);
  }

  const token = await signMobileToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  return jsonResponse({
    success: true,
    token,
    driver: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
}

export function OPTIONS() {
  return noContentResponse();
}
