"use client";

import { useState } from "react";

type CustomerEditClientProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customer: any;
};

export default function CustomerEditClient({ customer }: CustomerEditClientProps) {
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const handleVerifyEmail = async (userId: string) => {
    if (!confirm("Are you sure you want to manually verify this user's email?")) {
      return;
    }

    setVerifyingEmail(true);
    
    try {
      const response = await fetch('/api/users/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to verify email');
      }

      alert('Email manually verified in backend!');
      window.location.reload();
    } catch (error) {
      console.error('Error verifying email:', error);
      alert('Failed to verify email. Please try again.');
    } finally {
      setVerifyingEmail(false);
    }
  };

  const handleResetPassword = async (userId: string, email: string | null) => {
    if (!confirm(`Send password reset link to ${email || 'this user'}?`)) {
      return;
    }

    setSendingReset(true);
    
    try {
      const response = await fetch('/api/users/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to send reset link');
      }

      alert('Password reset link sent successfully!');
    } catch (error) {
      console.error('Error sending reset link:', error);
      alert('Failed to send reset link. Please try again.');
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-[var(--text-strong)]">
          Edit Customer
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Update customer profile information and preferences
        </p>
      </header>

      <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6">
        <form className="space-y-6" action="/api/customers/update" method="POST">
          <input type="hidden" name="customerId" value={customer.id} />
          
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--text-strong)]">
                Name
              </label>
              <input
                type="text"
                name="name"
                defaultValue={customer.name || ""}
                placeholder="Enter customer name"
                className="w-full h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--text-strong)]">
                Email
              </label>
              <input
                type="email"
                name="email"
                defaultValue={customer.email || ""}
                placeholder="Enter email address"
                className="w-full h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--text-strong)]">
                Phone Number
              </label>
              <input
                type="tel"
                name="phoneNumber"
                defaultValue={customer.phoneNumber || ""}
                placeholder="Enter phone number"
                className="w-full h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--text-strong)]">
                Email Verified
              </label>
              <div className="flex items-center h-11 gap-3">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                  customer.emailVerified 
                    ? "bg-emerald-100 text-emerald-700" 
                    : "bg-amber-100 text-amber-700"
                }`}>
                  {customer.emailVerified ? "Verified" : "Not Verified"}
                </span>
                <button
                  type="button"
                  onClick={() => handleVerifyEmail(customer.id)}
                  disabled={verifyingEmail || customer.emailVerified !== null}
                  className="inline-flex items-center justify-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {verifyingEmail ? 'Verifying...' : customer.emailVerified ? 'Already Verified' : 'Verify Email'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--text-strong)]">
                Reset Password
              </label>
              <div className="flex items-center h-11">
                <button
                  type="button"
                  onClick={() => handleResetPassword(customer.id, customer.email)}
                  disabled={sendingReset}
                  className="inline-flex items-center justify-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600 transition hover:bg-amber-100 disabled:opacity-50"
                >
                  {sendingReset ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--text-strong)]">
                Loyalty Points
              </label>
              <div className="flex items-center h-11">
                <span className="font-mono text-sm text-[var(--text-strong)]">
                  {customer.loyaltyRedeemedPoints} points
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--text-strong)]">
                Loyalty Credit
              </label>
              <div className="flex items-center h-11">
                <span className="font-mono text-sm text-[var(--text-strong)]">
                  {new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(customer.loyaltyCreditCents / 100)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)]"
            >
              Save Changes
            </button>
            <a
              href={`/admin/customers/${customer.id}`}
              className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-6 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
            >
              Cancel
            </a>
          </div>
        </form>
      </div>

      {/* Recent Bookings */}
      {customer.bookings && customer.bookings.length > 0 && (
        <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-strong)] mb-4">
            Recent Bookings
          </h2>
          <div className="space-y-3">
            {/* eslint-disable @typescript-eslint/no-explicit-any */}
            {customer.bookings.map((booking: any) => (
              <div key={booking.id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--surface-border)]">
                <div>
                  <p className="font-medium text-[var(--text-strong)]">
                    {booking.service?.name || "Service"}
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">
                    {booking.startAt ? new Date(booking.startAt).toLocaleDateString() : "No date"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-[var(--text-strong)]">
                    {booking.payment?.status === "PAID" ? "Paid" : "Unpaid"}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {booking.payment?.amountCents ? new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(booking.payment.amountCents / 100) : "No amount"}
                  </p>
                </div>
              </div>
            ))}
            {/* eslint-enable @typescript-eslint/no-explicit-any */}
          </div>
        </div>
      )}
    </div>
  );
}
