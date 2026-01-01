import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  
  console.log('[AdminAuth] Session check:', { 
    hasSession: !!session, 
    userId: session?.user?.id,
    role,
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
  
  if (role !== "ADMIN") {
    console.error('[AdminAuth] Invalid role:', role);
    throw new Error(`Access denied. Required role: ADMIN, Current role: ${role}`);
  }
  
  return session;
}
