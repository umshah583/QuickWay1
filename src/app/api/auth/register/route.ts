import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";
import { sendVerificationEmail } from "@/lib/email";
import crypto from "crypto";

const schema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email(),
  password: z.string().min(6),
  phoneNumber: z.string().trim().min(5, "Enter a valid phone number"),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }
  const { name, email, password, phoneNumber } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return errorResponse("Email already in use", 409);
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  
  // Generate verification token (expires in 30 minutes)
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationExpires = new Date(Date.now() + 30 * 60 * 1000);

  const user = await prisma.user.create({
    data: { 
      name: name ?? null, 
      email, 
      passwordHash, 
      phoneNumber, 
      role: "USER",
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
    },
  });

  // Send verification email
  try {
    await sendVerificationEmail(email, verificationToken);
  } catch (emailError) {
    console.error("Failed to send verification email:", emailError);
    // User is still created, they can request a new verification email later
  }

  return jsonResponse({ 
    id: user.id, 
    message: "Account created! Please check your email to verify your account." 
  }, { status: 201 });
}

export function OPTIONS() {
  return noContentResponse();
}
