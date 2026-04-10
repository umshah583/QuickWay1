import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { decode } from "next-auth/jwt";
import { cookies } from "next/headers";

import { authOptions } from "@/lib/auth";

const SESSION_COOKIE_NAME = process.env.NODE_ENV === "production"
  ? "__Secure-next-auth.session-token"
  : "next-auth.session-token";

async function getSessionFromCookie(): Promise<Session | null> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("[AdminAuth] NEXTAUTH_SECRET missing; cannot decode session cookie");
    return null;
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    console.warn("[AdminAuth] Session cookie missing");
    return null;
  }

  const payload = await decode({ token: sessionToken, secret });
  if (!payload) {
    console.warn("[AdminAuth] Failed to decode session token");
    return null;
  }

  const expTime = typeof payload.exp === 'number' ? payload.exp : 0;
  const expires = expTime ? new Date(expTime * 1000).toISOString() : new Date(Date.now() + 60 * 60 * 1000).toISOString();

  return {
    user: {
      id: typeof payload.sub === "string" ? payload.sub : undefined,
      email: typeof payload.email === "string" ? payload.email : undefined,
      role: payload.role as string,
      roleKey: payload.roleKey as string | undefined,
    },
    expires,
  } as Session;
}

export async function requireAdminSession() {
  const session = (await getServerSession(authOptions)) ?? (await getSessionFromCookie());
  const user = session?.user as { role?: string; roleKey?: string } | undefined;
  const role = user?.role;
  const roleKey = user?.roleKey?.toLowerCase() ?? role?.toLowerCase();
  
  console.log('[AdminAuth] Session check:', { 
    hasSession: !!session, 
    userId: session?.user?.id,
    role,
    roleKey,
    userEmail: session?.user?.email
  });
  
  if (!session) {
    console.error('[AdminAuth] No session found');
    throw new Error("No session found. Please sign in.");
  }
  
  if (!role) {
    console.error('[AdminAuth] No role in session');
    throw new Error("No role found in session.");
  }
  
  // Check roleKey for admin-like roles (admin, manager, etc.)
  const adminRoles = ['admin', 'manager'];
  if (!adminRoles.includes(roleKey || '')) {
    console.error('[AdminAuth] Invalid role:', role, 'roleKey:', roleKey);
    throw new Error(`Access denied. Required role: ADMIN, Current role: ${role}`);
  }
  
  return session;
}
