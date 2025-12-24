"use client";

import { useState, useEffect, useRef } from "react";
import PartnerServiceAttributeFields, { type PartnerServiceType } from "./PartnerServiceAttributeFields";

interface RequestServiceModalProps {
  serviceTypes: PartnerServiceType[];
  action: (formData: FormData) => Promise<void>;
}

export default function RequestServiceModal({ serviceTypes, action }: RequestServiceModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => document.body.classList.remove("overflow-hidden");
  }, [isOpen]);

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      setIsOpen(false);
    }
  };

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    try {
      await action(formData);
      setIsOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={serviceTypes.length === 0}
        className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-primary)]/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Request new service
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-10"
          onClick={handleBackdropClick}
        >
          <div
            ref={dialogRef}
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-[var(--text-strong)]">Request a new service</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Fill out the form below and our team will review your service before it goes live.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              >
                Close
              </button>
            </div>

            <form action={handleSubmit} className="mt-4 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs font-medium text-[var(--text-label)]">Service name</span>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="e.g. Premium Exterior Wash"
                    className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                  />
                </label>

                <PartnerServiceAttributeFields serviceTypes={serviceTypes} />

                <label className="space-y-1">
                  <span className="text-xsfont-medium text-[var(--text-label)]">Duration (minutes)</span>
                  <input
                    type="number"
                    name="durationMin"
                    min={10}
                    step={5}
                    required
                    placeholder="e.g. 45"
                    className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-[var(--text-label)]">Base price (AED)</span>
                  <input
                    type="number"
                    name="price"
                    min={1}
                    step="0.5"
                    required
                    placeholder="e.g. 45"
                    className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                  />
                </label>

                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs font-medium text-[var(--text-label)]">Image URL (optional)</span>
                  <input
                    type="url"
                    name="imageUrl"
                    placeholder="https://example.com/service-image.jpg"
                    className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                  />
                  <p className="text-[10px] text-[var(--text-muted)]">Provide a link that represents the service (optional).</p>
                </label>

                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs font-medium text-[var(--text-label)]">Description (optional)</span>
                  <textarea
                    name="description"
                    rows={3}
                    placeholder="Describe what is included in this service"
                    className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-sm font-semibold text-[var(--text-strong)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-primary)]/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Submitting..." : "Submit for approval"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
