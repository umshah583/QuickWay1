"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createPartnerDriver, type CreatePartnerDriverState } from "./actions";

const initialState: CreatePartnerDriverState = {};

function SubmitButton({ disabledOverride = false }: { disabledOverride?: boolean }) {
  const { pending } = useFormStatus();
  const disabled = pending || disabledOverride;

  return (
    <button
      type="submit"
      disabled={disabled}
      className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-secondary)] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Submitting request…" : disabledOverride ? "Resubmission locked" : "Submit request"}
    </button>
  );
}

export function PartnerAddDriverForm() {
  const searchParams = useSearchParams();
  const requestId = searchParams.get("requestId");
  const rejectionCountParam = searchParams.get("rejections");
  const parsedRejections = rejectionCountParam !== null ? Number(rejectionCountParam) : null;
  const rejectionCount = parsedRejections !== null && !Number.isNaN(parsedRejections) ? parsedRejections : 0;
  const resubmitMode = Boolean(requestId);
  const attemptsRemaining = Math.max(0, 3 - rejectionCount);
  const reachedLimit = resubmitMode && attemptsRemaining === 0;

  const [state, formAction] = useActionState(createPartnerDriver, initialState);
  const [documentType, setDocumentType] = useState<'LABOUR_CARD' | 'EMIRATES_ID'>('LABOUR_CARD');

  return (
    <form action={formAction} className="space-y-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-7 shadow-sm">
      {requestId ? <input type="hidden" name="requestId" value={requestId} /> : null}

      {resubmitMode ? (
        <div className="rounded-xl border border-[var(--brand-primary)]/40 bg-[var(--brand-primary)]/10 px-3 py-2 text-xs text-[var(--text-strong)]">
          Resubmitting rejected request. Attempts used: {rejectionCount}/3. {attemptsRemaining > 0 ? `${attemptsRemaining} attempt${attemptsRemaining > 1 ? 's' : ''} remaining.` : 'No attempts remaining.'}
        </div>
      ) : null}

      {reachedLimit ? (
        <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">
          You have reached the maximum number of resubmission attempts for this driver. Please contact support for further assistance.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-[var(--text-strong)]">Driver name</span>
          <input
            type="text"
            name="name"
            required
            placeholder="Driver name"
            className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-[var(--text-strong)]">Driver email</span>
          <input
            type="email"
            name="email"
            required
            placeholder="driver@example.com"
            className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-[var(--text-strong)]">Driver mobile number</span>
          <input
            type="tel"
            name="mobileNumber"
            required
            placeholder="9715XXXXXXX"
            className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
          />
        </label>
      </div>
      <label className="flex flex-col gap-2 text-sm sm:w-80">
        <span className="font-medium text-[var(--text-strong)]">Temporary password</span>
        <input
          type="password"
          name="password"
          required
          minLength={6}
          placeholder="Minimum 6 characters"
          className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-[var(--text-strong)]">Visa issue date</span>
          <input
            type="date"
            name="visaIssueDate"
            required
            className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-[var(--text-strong)]">Visa expiry date</span>
          <input
            type="date"
            name="visaExpiryDate"
            required
            className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
          />
        </label>
      </div>
      <fieldset className="space-y-3 rounded-xl border border-dashed border-[var(--surface-border)] bg-white px-4 py-4">
        <legend className="px-2 text-sm font-medium text-[var(--text-strong)]">Identification document</legend>
        <p className="text-xs text-[var(--text-muted)]">
          Upload either a labour card or an Emirates ID copy. Required files depend on the document type selected below.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-strong)]">
            <input
              type="radio"
              name="documentType"
              value="LABOUR_CARD"
              checked={documentType === 'LABOUR_CARD'}
              onChange={() => setDocumentType('LABOUR_CARD')}
              required
              className="h-4 w-4 border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
            />
            Labour card
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-strong)]">
            <input
              type="radio"
              name="documentType"
              value="EMIRATES_ID"
              checked={documentType === 'EMIRATES_ID'}
              onChange={() => setDocumentType('EMIRATES_ID')}
              className="h-4 w-4 border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
            />
            Emirates ID
          </label>
        </div>

        {documentType === 'LABOUR_CARD' ? (
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-[var(--text-strong)]">Upload labour card (PDF or image)</span>
            <input
              type="file"
              name="labourCard"
              required
              accept="application/pdf,image/*"
              className="block w-full text-sm text-[var(--text-strong)] file:mr-4 file:rounded-full file:border-0 file:bg-[var(--brand-primary)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[var(--brand-secondary)]"
            />
          </label>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-[var(--text-strong)]">Upload Emirates ID (front)</span>
              <input
                type="file"
                name="emiratesIdFront"
                required={documentType === 'EMIRATES_ID'}
                accept="application/pdf,image/*"
                className="block w-full text-sm text-[var(--text-strong)] file:mr-4 file:rounded-full file:border-0 file:bg-[var(--brand-primary)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[var(--brand-secondary)]"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-[var(--text-strong)]">Upload Emirates ID (back)</span>
              <input
                type="file"
                name="emiratesIdBack"
                required={documentType === 'EMIRATES_ID'}
                accept="application/pdf,image/*"
                className="block w-full text-sm text-[var(--text-strong)] file:mr-4 file:rounded-full file:border-0 file:bg-[var(--brand-primary)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[var(--brand-secondary)]"
              />
            </label>
          </div>
        )}
      </fieldset>
      {state?.error ? (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{state.error}</p>
      ) : null}
      <div className="flex items-center gap-3">
        <SubmitButton disabledOverride={reachedLimit} />
        <Link
          href="/partner/drivers"
          className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-6 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
        >
          Cancel
        </Link>
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        Drivers receive their credentials via the email you provide. Ask them to reset their password after first login for security. Ensure the
        uploaded documents are clear and valid to avoid delays.
      </p>
    </form>
  );
}
