import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { UserRole as PrismaUserRole } from "@prisma/client";
import type { UserRole } from "@prisma/client";
import prisma from "./prisma";

export type MobileSessionPayload = {
  sub: string;
  email?: string | null;
  name?: string | null;
  role: UserRole;
  tokenVersion?: number;
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
  
  // Get current token version from database
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { tokenVersion: true }
  });
  
  if (!user) {
    throw new Error("User not found");
  }
  
  return new SignJWT({
    email: payload.email ?? null,
    name: payload.name ?? null,
    role: payload.role,
    tokenVersion: user.tokenVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("100y") // Never expire - mobile users stay logged in until explicit logout
    .sign(secret);
}

type TokenPayload = JWTPayload & {
  email?: string | null;
  name?: string | null;
  role?: UserRole | string | null;
  tokenVersion?: number;
};

export async function verifyMobileToken(token: string): Promise<MobileSessionPayload> {
  const secret = getSecret();
  const { payload } = await jwtVerify(token, secret);
  const typedPayload = payload as TokenPayload;
  
  // Get current user from database to check token version
  const user = await prisma.user.findUnique({
    where: { id: typedPayload.sub! },
    select: { 
      id: true,
      email: true,
      name: true,
      role: true,
      tokenVersion: true
    }
  });
  
  if (!user) {
    throw new Error("User not found");
  }
  
  // Check if token version matches current database version
  if (typedPayload.tokenVersion !== user.tokenVersion) {
    throw new Error("Token has been invalidated (force logout)");
  }
  
  const roleValue =
    typeof typedPayload.role === "string" && Object.values(PrismaUserRole).includes(typedPayload.role as UserRole)
      ? (typedPayload.role as UserRole)
      : "USER";
      
  return {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: roleValue,
    tokenVersion: user.tokenVersion,
  };
}

export async function getMobileUserFromRequest(req: Request): Promise<MobileSessionPayload | null> {
  const authHeader = req.headers.get("authorization");
  console.log('[Mobile Auth] Authorization header present:', !!authHeader);

  if (!authHeader) {
    console.log('[Mobile Auth] No authorization header');
    return null;
  }

  console.log('[Mobile Auth] Authorization header:', authHeader.substring(0, 50) + '...');

  const [scheme, token] = authHeader.split(" ");
  console.log('[Mobile Auth] Scheme:', scheme, 'Token present:', !!token);

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    console.log('[Mobile Auth] Invalid authorization header format');
    return null;
  }

  try {
    const payload = await verifyMobileToken(token);
    console.log(`[Mobile Auth] Authenticated user: ${payload.sub}, role: ${payload.role}, email: ${payload.email}`);
    return payload;
  } catch (error) {
    console.error('[Mobile Auth] Token verification failed:', error);
    return null;
  }
}
