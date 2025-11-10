import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { UserRole as PrismaUserRole } from "@prisma/client";
import type { UserRole } from "@prisma/client";

export type MobileSessionPayload = {
  sub: string;
  email?: string | null;
  name?: string | null;
  role: UserRole;
};

const encoder = new TextEncoder();

function getSecret(): Uint8Array {
  const secret = process.env.MOBILE_JWT_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("MOBILE_JWT_SECRET (or NEXTAUTH_SECRET) must be set for mobile auth");
  }
  return encoder.encode(secret);
}

export async function signMobileToken(payload: MobileSessionPayload): Promise<string> {
  const secret = getSecret();
  return new SignJWT({
    email: payload.email ?? null,
    name: payload.name ?? null,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

type TokenPayload = JWTPayload & {
  email?: string | null;
  name?: string | null;
  role?: UserRole | string | null;
};

export async function verifyMobileToken(token: string): Promise<MobileSessionPayload> {
  const secret = getSecret();
  const { payload } = await jwtVerify(token, secret);
  const typedPayload = payload as TokenPayload;
  const roleValue =
    typeof typedPayload.role === "string" && Object.values(PrismaUserRole).includes(typedPayload.role as UserRole)
      ? (typedPayload.role as UserRole)
      : "USER";
  return {
    sub: String(payload.sub),
    email: typedPayload.email ?? null,
    name: typedPayload.name ?? null,
    role: roleValue,
  };
}

export async function getMobileUserFromRequest(req: Request): Promise<MobileSessionPayload | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  try {
    return await verifyMobileToken(token);
  } catch (error) {
    console.error("Failed to verify mobile token", error);
    return null;
  }
}
