"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!token) {
      setError("Invalid reset link");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/sign-in");
        }, 3000);
      } else {
        setError(data?.error ?? "Failed to reset password");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <div className="mb-4 text-4xl">❌</div>
          <h1 className="text-2xl font-semibold mb-3 text-red-900">Invalid Reset Link</h1>
          <p className="text-gray-700 mb-4">
            This password reset link is invalid or has expired.
          </p>
          <a href="/auth/forgot-password" className="underline text-blue-600">
            Request a new reset link
          </a>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
          <div className="mb-4 text-4xl">✅</div>
          <h1 className="text-2xl font-semibold mb-3 text-green-900">Password Reset!</h1>
          <p className="text-gray-700 mb-4">
            Your password has been reset successfully. You can now sign in with your new password.
          </p>
          <p className="text-sm text-gray-600">Redirecting you to sign in...</p>
          <p className="mt-4">
            <a href="/sign-in" className="underline text-blue-600">
              Click here if not redirected automatically
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold mb-2">Reset your password</h1>
      <p className="text-gray-600 mb-6">Enter your new password below.</p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            New password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="At least 6 characters"
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder="Re-enter your password"
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
          {loading ? "Resetting..." : "Reset password"}
        </button>
      </form>

      <p className="mt-6 text-sm text-center">
        <a href="/sign-in" className="underline">Back to sign in</a>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="text-center">Loading...</div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
