"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setSuccess(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Failed to process request");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
          <div className="mb-4 text-4xl">📧</div>
          <h1 className="text-2xl font-semibold mb-3 text-green-900">Check your email!</h1>
          <p className="text-gray-700 mb-4">
            If an account exists with <strong>{email}</strong>, you will receive a password reset link shortly.
          </p>
          <p className="text-sm text-gray-600 mb-4">
            The link will expire in 30 minutes. If you don&apos;t see the email, check your spam folder.
          </p>
          <button 
            onClick={() => setSuccess(false)} 
            className="underline text-blue-600"
          >
            Request another reset
          </button>
        </div>
        <p className="mt-4 text-sm text-center">
          <a href="/sign-in" className="underline">Back to sign in</a>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold mb-2">Forgot your password?</h1>
      <p className="text-gray-600 mb-6">Enter your email address and we&apos;ll send you a link to reset your password.</p>
      
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="your@email.com"
            className="w-full border rounded px-3 py-2"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-black text-white py-2 disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>

      <p className="mt-6 text-sm text-center space-y-2">
        <a href="/sign-in" className="block underline">Back to sign in</a>
        <a href="/sign-up" className="block underline">Don&apos;t have an account? Sign up</a>
      </p>
    </div>
  );
}
