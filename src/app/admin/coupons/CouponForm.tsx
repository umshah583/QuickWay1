"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";

export type CouponFormValues = {
  id?: string;
  code?: string;
  name?: string;
  description?: string | null;
  discountType?: "PERCENTAGE" | "AMOUNT";
  discountValue?: number | null;
  maxRedemptions?: number | null;
  maxRedemptionsPerUser?: number | null;
  minBookingAmountCents?: number | null;
  validFrom?: Date | string | null;
  validUntil?: Date | string | null;
  active?: boolean;
  appliesToAllServices?: boolean;
  applicableServiceIds?: string[];
};

type CouponFormProps = {
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
  cancelHref: string;
  services: { id: string; name: string; priceCents: number }[];
  values?: CouponFormValues;
  disableCode?: boolean;
};

function formatDateTimeInput(value?: Date | string | null) {
  if (!value) return new Date().toISOString().slice(0, 16);
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)] disabled:cursor-not-allowed disabled:opacity-65"
    >
      {pending ? "Saving..." : label}
    </button>
  );
}

export default function CouponForm({ action, submitLabel, cancelHref, services, values, disableCode = false }: CouponFormProps) {
  const [discountType, setDiscountType] = useState<"PERCENTAGE" | "AMOUNT">(values?.discountType ?? "PERCENTAGE");
  const [discountValue, setDiscountValue] = useState<string>(() => {
    if (values?.discountValue == null) return "";
    if (values.discountType === "AMOUNT") {
      return (values.discountValue / 100).toString();
    }
    return values.discountValue.toString();
  });
  const [minBookingAmount, setMinBookingAmount] = useState<string>(() => {
    if (!values?.minBookingAmountCents) return "";
    return (values.minBookingAmountCents / 100).toString();
  });
  const [limitToServices, setLimitToServices] = useState<boolean>(() => !(values?.appliesToAllServices ?? true));

  const defaultSelectedServices = useMemo(() => values?.applicableServiceIds ?? [], [values?.applicableServiceIds]);

  const [code, setCode] = useState<string>(values?.code ?? "");

  useEffect(() => {
    if (values?.code || disableCode) {
      setCode(values?.code ?? "");
      return;
    }
    setCode(generateCode());
  }, [values?.code, disableCode]);

  function regenerateCode() {
    const next = generateCode();
    setCode(next);
  }

  function generateCode() {
    const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    const length = 8;
    let result = "";
    for (let i = 0; i < length; i += 1) {
      result += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return result;
  }

  return (
    <form action={action} className="space-y-6">
      {values?.id ? <input type="hidden" name="id" defaultValue={values.id} /> : null}
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="appliesToAllServices" value={limitToServices ? "false" : "true"} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-[var(--text-strong)]">Coupon code</span>
          <div className="flex items-center gap-3">
            <span className="inline-flex min-h-[2.5rem] items-center rounded-lg border border-dashed border-[var(--surface-border)] bg-white px-3 py-2 font-mono text-sm uppercase tracking-[0.3em] text-[var(--text-strong)]">
              {code}
            </span>
            {!disableCode ? (
              <button
                type="button"
                onClick={regenerateCode}
                className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
              >
                Generate new
              </button>
            ) : null}
          </div>
          <p className="text-xs text-[var(--text-muted)]">Codes are auto-generated to avoid duplicates. Share the code with customers to redeem.</p>
        </div>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-[var(--text-strong)]">Display name</span>
          <input
            name="name"
            type="text"
            required
            defaultValue={values?.name ?? ""}
            className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
          />
        </label>
      </div>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-[var(--text-strong)]">Description</span>
        <textarea
          name="description"
          defaultValue={values?.description ?? ""}
          rows={3}
          className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-[var(--text-strong)]">Discount type</span>
          <select
            name="discountType"
            value={discountType}
            onChange={(event) => {
              const next = event.target.value as "PERCENTAGE" | "AMOUNT";
              setDiscountType(next);
              if (next === "PERCENTAGE") {
                setDiscountValue((current) => {
                  const cents = Number.parseFloat(current || "0");
                  return Number.isFinite(cents) ? String(Math.round(cents)) : "";
                });
              }
            }}
            className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
          >
            <option value="PERCENTAGE">Percentage off</option>
            <option value="AMOUNT">Flat amount (AED)</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-[var(--text-strong)]">Discount value</span>
          <input
            name="discountValue"
            type="number"
            step={discountType === "AMOUNT" ? "0.01" : "1"}
            min={0}
            max={discountType === "PERCENTAGE" ? 100 : undefined}
            value={discountValue}
            onChange={(event) => setDiscountValue(event.target.value)}
            required
            className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-[var(--text-strong)]">Min booking amount (AED)</span>
          <input
            name="minBookingAmount"
            type="number"
            min={0}
            step="0.01"
            value={minBookingAmount}
            onChange={(event) => setMinBookingAmount(event.target.value)}
            className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-[var(--text-strong)]">Max redemptions</span>
          <input
            name="maxRedemptions"
            type="number"
            min={0}
            defaultValue={values?.maxRedemptions ?? ""}
            className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-[var(--text-strong)]">Max per user</span>
          <input
            name="maxRedemptionsPerUser"
            type="number"
            min={0}
            defaultValue={values?.maxRedemptionsPerUser ?? ""}
            className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-[var(--text-strong)]">Valid from</span>
          <input
            name="validFrom"
            type="datetime-local"
            defaultValue={formatDateTimeInput(values?.validFrom)}
            className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-[var(--text-strong)]">Valid until</span>
          <input
            name="validUntil"
            type="datetime-local"
            defaultValue={formatDateTimeInput(values?.validUntil)}
            className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
          />
        </label>
      </div>

      <div className="space-y-3 rounded-2xl border border-[var(--surface-border)] bg-white/70 p-4">
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={!limitToServices}
            onChange={(event) => setLimitToServices(!event.target.checked)}
            className="h-4 w-4 rounded border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
          />
          <span className="text-[var(--text-strong)]">Coupon applies to all services</span>
        </label>
        <div className={limitToServices ? "space-y-2" : "hidden"}>
          <p className="text-xs text-[var(--text-muted)]">Select services that this coupon can be redeemed against.</p>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-[var(--surface-border)] bg-white p-3 text-sm">
            {services.length === 0 ? (
              <p className="text-[var(--text-muted)]">No services available.</p>
            ) : (
              services.map((service) => {
                const checked = defaultSelectedServices.includes(service.id);
                return (
                  <label key={service.id} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      name="serviceIds"
                      value={service.id}
                      defaultChecked={checked}
                      className="h-4 w-4 rounded border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                    />
                    <span className="flex-1 text-[var(--text-strong)]">
                      {service.name}
                      <span className="ml-2 text-xs text-[var(--text-muted)]">
                        AED {(service.priceCents / 100).toFixed(2)}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </div>

      <label className="flex items-center gap-3 text-sm">
        <input
          name="active"
          type="checkbox"
          defaultChecked={values?.active ?? true}
          className="h-4 w-4 rounded border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
        />
        <span className="text-[var(--text-strong)]">Coupon is active</span>
      </label>

      <div className="flex items-center gap-3">
        <SubmitButton label={submitLabel} />
        <Link
          href={cancelHref}
          className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-5 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
