"use client";

import { Suspense, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "next-auth";
import { signIn, getSession } from "next-auth/react";
import type { SignInResponse } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-12 text-sm text-[var(--text-muted)]">Loading sign-in…</div>}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/account";

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
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold mb-6">Sign in</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="Email"
          className="w-full border rounded px-3 py-2"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="Password"
          className="w-full border rounded px-3 py-2"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="w-full rounded bg-black text-white py-2">
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-sm">
        <a href="/auth/forgot-password" className="underline">Forgot password?</a>
      </p>
      <p className="mt-2 text-sm">
        No account? <a href="/sign-up" className="underline">Sign up</a>
      </p>
    </div>
  );
}
