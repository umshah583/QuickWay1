"use client";

import { useState } from "react";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [success, setSuccess] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, phoneNumber }),
    });
    if (res.ok) {
      setSuccess(true);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "Registration failed");
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
          <div className="mb-4 text-4xl">✅</div>
          <h1 className="text-2xl font-semibold mb-3 text-green-900">Check your email!</h1>
          <p className="text-gray-700 mb-4">
            We&apos;ve sent a verification link to <strong>{email}</strong>
          </p>
          <p className="text-sm text-gray-600 mb-4">
            Click the link in the email to verify your account. The link will expire in 30 minutes.
          </p>
          <p className="text-xs text-gray-500">
            Didn&apos;t receive the email? Check your spam folder or{" "}
            <button 
              onClick={() => setSuccess(false)} 
              className="underline text-blue-600"
            >
              try again
            </button>
          </p>
        </div>
        <p className="mt-4 text-sm text-center">
          <a href="/sign-in" className="underline">Back to sign in</a>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold mb-6">Create your account</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" className="w-full border rounded px-3 py-2" />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email" className="w-full border rounded px-3 py-2" />
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          required
          placeholder="Mobile number"
          className="w-full border rounded px-3 py-2"
        />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Password (min 6 chars)" className="w-full border rounded px-3 py-2" />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="w-full rounded bg-black text-white py-2">{loading ? "Creating..." : "Sign up"}</button>
      </form>
      <p className="mt-4 text-sm">Already have an account? <a href="/sign-in" className="underline">Sign in</a></p>
    </div>
  );
}
