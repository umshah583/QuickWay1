"use client";

import { Suspense, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "next-auth";
import { signIn, getSession } from "next-auth/react";
import type { SignInResponse } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, ArrowRight } from "lucide-react";
import Image from "next/image";

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 via-blue-50 to-sky-100">
        <div className="text-cyan-600 text-sm font-medium">Loading sign-in…</div>
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") ?? "/account";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const res: SignInResponse | undefined = await signIn("credentials", {
      redirect: false,
      email,
      password,
      callbackUrl,
    });
    setLoading(false);
    if (!res) return;
    if (res.ok) {
      await new Promise((r) => setTimeout(r, 150));
      let session: Session | null = await getSession();
      if (!session) {
        await new Promise((r) => setTimeout(r, 200));
        session = await getSession();
      }
      if (session?.user?.role === "ADMIN") {
        return router.push("/admin");
      }
      if (session?.user?.role === "DRIVER") {
        return router.push("/driver");
      }
      if (session?.user?.role === "PARTNER") {
        return router.push("/partner");
      }
      return router.push(res.url ?? callbackUrl);
    }
    else setError(res.error ?? "Invalid credentials");
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-cyan-50 via-blue-50 to-sky-100">
      {/* Animated water bubbles background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-cyan-200/30 rounded-full blur-2xl animate-float" />
        <div className="absolute top-40 right-20 w-40 h-40 bg-blue-200/30 rounded-full blur-3xl animate-float-delayed" />
        <div className="absolute bottom-32 left-1/4 w-36 h-36 bg-sky-200/30 rounded-full blur-2xl animate-float-slow" />
        <div className="absolute bottom-20 right-1/3 w-28 h-28 bg-cyan-300/20 rounded-full blur-xl animate-float" />
        <div className="absolute top-1/3 left-1/2 w-24 h-24 bg-blue-300/20 rounded-full blur-2xl animate-float-delayed" />
        
        {/* Wave shapes */}
        <svg className="absolute bottom-0 left-0 w-full h-48 opacity-20" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path fill="#06b6d4" fillOpacity="0.3" d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,160C1248,160,1344,128,1392,112L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
        </svg>
        <svg className="absolute bottom-0 left-0 w-full h-40 opacity-30" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path fill="#0ea5e9" fillOpacity="0.4" d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,213.3C672,224,768,224,864,213.3C960,203,1056,181,1152,181.3C1248,181,1344,203,1392,213.3L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
        </svg>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo and branding */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-6 transform hover:scale-105 transition-transform">
              <Image 
                src="/logo.png" 
                alt="QuickWay Logo" 
                width={120} 
                height={120}
                className="drop-shadow-2xl"
                priority
              />
            </div>
          </div>

          {/* Login card */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-cyan-500/10 border border-white/50 p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome Back</h2>
            <p className="text-gray-600 mb-8">Sign in to manage your car wash services</p>

            <form onSubmit={onSubmit} className="space-y-5">
              {/* Email input */}
              <div className="relative">
                <label htmlFor="email" className="block text-sm font-semibold text-[var(--text-strong)] mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-500" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="your@email.com"
                    className="w-full pl-12 pr-4 py-3.5 bg-[var(--glass-bg)] border-2 border-[var(--surface-border)] rounded-2xl focus:outline-none focus:border-[var(--brand-primary)] focus:bg-white transition-all text-[var(--text-strong)] placeholder:text-[var(--text-muted)]"
                  />
                </div>
              </div>

              {/* Password input */}
              <div className="relative">
                <label htmlFor="password" className="block text-sm font-semibold text-[var(--text-strong)] mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-500" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                    className="w-full pl-12 pr-4 py-3.5 bg-[var(--glass-bg)] border-2 border-[var(--surface-border)] rounded-2xl focus:outline-none focus:border-[var(--brand-primary)] focus:bg-white transition-all text-[var(--text-strong)] placeholder:text-[var(--text-muted)]"
                  />
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
                  <p className="text-red-700 text-sm font-medium">{error}</p>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/40 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            {/* Links */}
            <div className="mt-6 text-center">
              <div className="pt-4 border-t border-gray-200" />
            </div>
          </div>

          {/* Trust badge */}
          <div className="mt-8 text-center">
            <p className="text-cyan-700/70 text-sm font-medium">
              🔒 Secure & Trusted by 1000+ customers
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-20px) translateX(10px); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-30px) translateX(-15px); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-15px) translateX(20px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float-delayed 8s ease-in-out infinite;
        }
        .animate-float-slow {
          animation: float-slow 10s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
