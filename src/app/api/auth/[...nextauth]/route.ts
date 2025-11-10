import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

console.log("[NextAuth route] NextAuth typeof", typeof NextAuth);

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
