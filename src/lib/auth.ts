import type { NextAuthOptions, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import prisma from "@/lib/prisma";
import { signMobileToken } from "@/lib/mobile-session";

type AuthUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role: UserRole;
};

type RoleAwareJWT = JWT & { role?: UserRole };

type CredentialsInput = {
  email?: string;
  password?: string;
};

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  debug: process.env.NODE_ENV === "development",
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials: CredentialsInput | undefined) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user || !user.passwordHash) return null;
        
        // Check if email is verified
        if (!user.emailVerified) {
          throw new Error("Please verify your email address before signing in. Check your inbox for the verification link.");
        }
        
        const valid = bcrypt.compareSync(credentials.password, user.passwordHash);
        if (!valid) return null;
        const authUser: AuthUser = {
          id: user.id,
          name: user.name ?? null,
          email: user.email ?? null,
          image: user.image ?? null,
          role: user.role,
        };
        return authUser;
      },
    }),
  ],
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    async jwt({ token, user }): Promise<JWT> {
      const roleAwareToken = token as RoleAwareJWT;
      if (user && "role" in user) {
        roleAwareToken.role = user.role ?? "USER";
      } else if (token?.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub as string },
          select: { role: true, name: true, email: true },
        });
        if (dbUser?.role) {
          roleAwareToken.role = dbUser.role;
          // Generate mobile JWT token for API calls
          try {
            const mobileToken = await signMobileToken({
              sub: token.sub,
              email: dbUser.email,
              name: dbUser.name,
              role: dbUser.role,
            });
            roleAwareToken.mobileToken = mobileToken;
          } catch (error) {
            console.error("Failed to generate mobile token:", error);
          }
        }
      }
      return roleAwareToken;
    },
    async session({ session, token }): Promise<Session> {
      if (session.user) {
        if (token.sub) {
          session.user.id = token.sub;
        }
        session.user.role = (token as RoleAwareJWT).role ?? "USER";
        // Include mobile token in session for client-side use
        const mobileToken = (token as RoleAwareJWT).mobileToken;
        (session as Session & { mobileToken?: string }).mobileToken = typeof mobileToken === 'string' ? mobileToken : undefined;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

