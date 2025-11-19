"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, Calendar, User, Lock, Save, Loader2 } from "lucide-react";

type Driver = {
  id: string;
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
  createdAt: string;
  role: string;
  partnerId: string | null;
};

export default function DriverProfilePage() {
  const params = useParams();
  const router = useRouter();
  const driverId = params.id as string;

  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function fetchDriver() {
      try {
        const res = await fetch(`/api/partner/drivers/${driverId}`);
        if (!res.ok) {
          throw new Error("Failed to fetch driver");
        }
        const data = await res.json();
        setDriver(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load driver");
      } finally {
        setLoading(false);
      }
    }

    fetchDriver();
  }, [driverId]);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/partner/drivers/${driverId}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update password");
      }

      setSuccess("Password updated successfully!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-primary)]" />
      </div>
    );
  }

  if (error && !driver) {
    return (
      <div className="space-y-4">
        <Link
          href="/partner/drivers"
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-medium)] hover:text-[var(--brand-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Drivers
        </Link>
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-6 py-4 text-rose-600">
          {error}
        </div>
      </div>
    );
  }

  if (!driver) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/partner/drivers"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--surface-border)] text-[var(--text-medium)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-semibold text-[var(--text-strong)]">Driver Profile</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">View and manage driver details</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Driver Information */}
        <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-[var(--surface-border)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-primary)]/10">
              <User className="h-6 w-6 text-[var(--brand-primary)]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-strong)]">Driver Information</h2>
              <p className="text-xs text-[var(--text-muted)]">Personal and contact details</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                Full Name
              </label>
              <p className="mt-1 text-sm font-medium text-[var(--text-strong)]">{driver.name || "N/A"}</p>
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                Driver ID
              </label>
              <p className="mt-1 font-mono text-sm text-[var(--text-medium)]">{driver.id}</p>
            </div>

            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-[var(--text-muted)]" />
              <div className="flex-1">
                <label className="text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                  Email Address
                </label>
                <p className="mt-1 text-sm text-[var(--text-medium)]">{driver.email || "N/A"}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-[var(--text-muted)]" />
              <div className="flex-1">
                <label className="text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                  Phone Number
                </label>
                <p className="mt-1 text-sm text-[var(--text-medium)]">{driver.phoneNumber || "N/A"}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[var(--text-muted)]" />
              <div className="flex-1">
                <label className="text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                  Joined Date
                </label>
                <p className="mt-1 text-sm text-[var(--text-medium)]">
                  {new Date(driver.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Password Update */}
        <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-[var(--surface-border)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
              <Lock className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-strong)]">Update Password</h2>
              <p className="text-xs text-[var(--text-muted)]">Change driver&apos;s login password</p>
            </div>
          </div>

          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-strong)] mb-2">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                minLength={6}
                className="h-11 w-full rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-strong)] mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                minLength={6}
                className="h-11 w-full rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-600">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={saving || !newPassword || !confirmPassword}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary)]/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Update Password
                </>
              )}
            </button>

            <p className="text-xs text-[var(--text-muted)]">
              Password must be at least 6 characters long. The driver will need to use the new
              password on their next login.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
