"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ServiceTypeAttribute = {
  name: string;
  type: "text" | "select" | "checkbox";
  options?: string[];
  required?: boolean;
};

type AttributesFormProps = {
  serviceTypeId: string;
  serviceTypeName: string;
  attributes: ServiceTypeAttribute[];
};

export default function AttributesForm({ serviceTypeId, serviceTypeName, attributes }: AttributesFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleCheckboxChange = (attrName: string, option: string, checked: boolean) => {
    setValues((prev) => {
      const current = (prev[attrName] as string[]) || [];
      if (checked) {
        return { ...prev, [attrName]: [...current, option] };
      } else {
        return { ...prev, [attrName]: current.filter((v) => v !== option) };
      }
    });
    setErrors((prev) => ({ ...prev, [attrName]: "" }));
  };

  const handleSelectChange = (attrName: string, value: string) => {
    setValues((prev) => ({ ...prev, [attrName]: value }));
    setErrors((prev) => ({ ...prev, [attrName]: "" }));
  };

  const handleTextChange = (attrName: string, value: string) => {
    setValues((prev) => ({ ...prev, [attrName]: value }));
    setErrors((prev) => ({ ...prev, [attrName]: "" }));
  };

  const handleContinue = () => {
    // Validate required fields
    const newErrors: Record<string, string> = {};
    for (const attr of attributes) {
      if (attr.required) {
        const val = values[attr.name];
        if (!val || (Array.isArray(val) && val.length === 0)) {
          newErrors[attr.name] = `${attr.name} is required`;
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Navigate to services page with attributes as query params
    const params = new URLSearchParams();
    params.set("typeId", serviceTypeId);
    params.set("attributes", JSON.stringify(values));
    router.push(`/book/services?${params.toString()}`);
  };

  // If no attributes, show message and continue button
  if (attributes.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-secondary)] p-6 text-center">
          <p className="text-[var(--text-muted)]">
            No additional options needed for {serviceTypeName}. Continue to select a service.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <Link
            href="/book"
            className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--brand-primary)]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <button
            onClick={handleContinue}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)]"
          >
            Continue
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 space-y-6">
        <h2 className="text-lg font-semibold text-[var(--text-strong)]">Select Your Preferences</h2>

        {attributes.map((attr, idx) => (
          <div key={idx} className="space-y-3">
            <label className="block text-sm font-medium text-[var(--text-strong)]">
              {attr.name}
              {attr.required && <span className="ml-1 text-red-500">*</span>}
            </label>

            {attr.type === "checkbox" && attr.options && (
              <div className="grid gap-2 sm:grid-cols-2">
                {attr.options.map((option) => (
                  <label
                    key={option}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                      ((values[attr.name] as string[]) || []).includes(option)
                        ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/5"
                        : "border-[var(--surface-border)] hover:border-[var(--brand-primary)]/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={((values[attr.name] as string[]) || []).includes(option)}
                      onChange={(e) => handleCheckboxChange(attr.name, option, e.target.checked)}
                      className="h-4 w-4 rounded border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                    />
                    <span className="text-sm text-[var(--text-strong)]">{option}</span>
                  </label>
                ))}
              </div>
            )}

            {attr.type === "select" && attr.options && (
              <select
                value={(values[attr.name] as string) || ""}
                onChange={(e) => handleSelectChange(attr.name, e.target.value)}
                className="w-full rounded-lg border border-[var(--surface-border)] bg-white px-4 py-3 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
              >
                <option value="">-- Select {attr.name} --</option>
                {attr.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            )}

            {attr.type === "text" && (
              <input
                type="text"
                value={(values[attr.name] as string) || ""}
                onChange={(e) => handleTextChange(attr.name, e.target.value)}
                placeholder={`Enter ${attr.name.toLowerCase()}`}
                className="w-full rounded-lg border border-[var(--surface-border)] bg-white px-4 py-3 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
              />
            )}

            {errors[attr.name] && (
              <p className="text-sm text-red-500">{errors[attr.name]}</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Link
          href="/book"
          className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--brand-primary)]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>
        <button
          onClick={handleContinue}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)]"
        >
          Continue
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
