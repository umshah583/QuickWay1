"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid verification link. Please try again or request a new verification email.");
      return;
    }

    async function verify() {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (res.ok) {
          setStatus("success");
          setMessage(data.message || "Email verified successfully!");
          setTimeout(() => {
            router.push("/sign-in");
          }, 3000);
        } else {
          setStatus("error");
          setMessage(data.error || "Verification failed. Please try again.");
        }
      } catch {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      }
    }

    verify();
  }, [token, router]);

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      {status === "verifying" && (
        <div className="text-center">
          <div className="mb-4 text-4xl">⏳</div>
          <h1 className="text-2xl font-semibold mb-3">Verifying your email...</h1>
          <p className="text-gray-600">Please wait while we verify your account.</p>
        </div>
      )}

      {status === "success" && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
          <div className="mb-4 text-4xl">✅</div>
          <h1 className="text-2xl font-semibold mb-3 text-green-900">Email Verified!</h1>
          <p className="text-gray-700 mb-4">{message}</p>
          <p className="text-sm text-gray-600">Redirecting you to sign in...</p>
          <p className="mt-4">
            <a href="/sign-in" className="underline text-blue-600">
              Click here if not redirected automatically
            </a>
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <div className="mb-4 text-4xl">❌</div>
          <h1 className="text-2xl font-semibold mb-3 text-red-900">Verification Failed</h1>
          <p className="text-gray-700 mb-4">{message}</p>
          <div className="space-y-2">
            <a href="/sign-up" className="block underline text-blue-600">
              Sign up again
            </a>
            <a href="/sign-in" className="block underline text-blue-600">
              Go to sign in
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="text-center">
          <div className="mb-4 text-4xl">⏳</div>
          <h1 className="text-2xl font-semibold mb-3">Loading...</h1>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
