import prisma from "@/lib/prisma";
import { z } from "zod";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";

const schema = z.object({
  userId: z.string().min(1),
  code: z.string().trim().length(6),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  const { userId, code } = parsed.data;
  const identifier = `phone:${userId}`;

  const tokenRecord = await prisma.verificationToken.findFirst({
    where: { identifier, token: code },
  });

  if (!tokenRecord) {
    return errorResponse("Invalid verification code", 400);
  }

  if (tokenRecord.expires < new Date()) {
    return errorResponse("Verification code has expired", 400);
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { phoneVerified: true },
    }),
    prisma.verificationToken.deleteMany({ where: { identifier } }),
  ]);

  return jsonResponse({ success: true });
}

export function OPTIONS() {
  return noContentResponse();
}
