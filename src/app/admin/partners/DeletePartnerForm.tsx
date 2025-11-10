"use client";

import { useCallback } from "react";
import type { FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { deletePartner } from "./actions";

type DeletePartnerFormProps = {
  partnerId: string;
  partnerName: string;
  className?: string;
};

function DeleteButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-full border border-rose-500/40 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Removing..." : label}
    </button>
  );
}

export default function DeletePartnerForm({ partnerId, partnerName, className }: DeletePartnerFormProps) {
  const boundDelete = deletePartner.bind(null, partnerId);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      if (!confirm(`Remove ${partnerName}? Drivers and bookings will be unassigned.`)) {
        event.preventDefault();
      }
    },
    [partnerName],
  );

  return (
    <form action={boundDelete} onSubmit={handleSubmit} className={className ?? "inline"}>
      <DeleteButton label="Delete" />
    </form>
  );
}
