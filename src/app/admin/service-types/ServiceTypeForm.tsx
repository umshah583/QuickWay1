"use client";

import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useState } from "react";
import { Plus, Trash2, GripVertical, Image as ImageIcon, Link as LinkIcon } from "lucide-react";
import {
  ServiceTypeAttribute,
  ServiceTypeAttributeOption,
  normalizeServiceTypeAttributes,
  normalizeAttributeOption,
} from "@/types/service-types";

type ServiceTypeFormValues = {
  id?: string;
  name?: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  active?: boolean;
  sortOrder?: number;
  attributes?: ServiceTypeAttribute[];
};

type ServiceTypeFormProps = {
  action: (formData: FormData) => Promise<void>;
  values?: ServiceTypeFormValues;
  submitLabel: string;
  cancelHref: string;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Saving..." : label}
    </button>
  );
}

const PRESET_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#8B5CF6", // Violet
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#84CC16", // Lime
];

export default function ServiceTypeForm({
  action,
  values,
  submitLabel,
  cancelHref,
}: ServiceTypeFormProps) {
  const [attributes, setAttributes] = useState<ServiceTypeAttribute[]>(
    normalizeServiceTypeAttributes(values?.attributes)
  );
  const [newOptionInputs, setNewOptionInputs] = useState<Record<number, { label: string; imageUrl?: string }>>({});

  const addAttribute = () => {
    setAttributes([
      ...attributes,
      { name: "", type: "checkbox", options: [], required: false },
    ]);
  };

  const removeAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index));
  };

  const updateAttribute = (index: number, updates: Partial<ServiceTypeAttribute>) => {
    setAttributes(
      attributes.map((attr, i) => (i === index ? { ...attr, ...updates } : attr))
    );
  };

  const updateOption = (
    attrIndex: number,
    optIndex: number,
    updates: Partial<ServiceTypeAttributeOption>,
  ) => {
    const attr = attributes[attrIndex];
    if (!attr) return;
    const nextOptions = (attr.options ?? []).map((option, index) =>
      index === optIndex ? ({ ...normalizeAttributeOption(option), ...updates }) : normalizeAttributeOption(option),
    );
    updateAttribute(attrIndex, { options: nextOptions });
  };

  const addOption = (attrIndex: number) => {
    const optionInputs = newOptionInputs[attrIndex];
    const label = optionInputs?.label?.trim();
    if (!label) return;

    const imageUrl = optionInputs?.imageUrl?.trim();
    const attr = attributes[attrIndex];
    const normalizedOptions = (attr.options ?? []).map(normalizeAttributeOption);
    if (normalizedOptions.some((option) => option.label.toLowerCase() === label.toLowerCase())) {
      return;
    }

    updateAttribute(attrIndex, {
      options: [...normalizedOptions, { label, imageUrl: imageUrl || undefined }],
    });
    setNewOptionInputs({
      ...newOptionInputs,
      [attrIndex]: { label: "", imageUrl: "" },
    });
  };

  const removeOption = (attrIndex: number, optionIndex: number) => {
    const attr = attributes[attrIndex];
    updateAttribute(attrIndex, {
      options: attr.options?.filter((_, i) => i !== optionIndex),
    });
  };

  return (
    <form action={action} className="space-y-6 max-w-2xl">
      {values?.id && <input type="hidden" name="id" defaultValue={values.id} />}
      <input type="hidden" name="attributes" value={JSON.stringify(attributes)} />

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-[var(--text-strong)]">Name *</span>
        <input
          name="name"
          type="text"
          required
          placeholder="e.g., Car Wash, Detailing, Oil Change"
          defaultValue={values?.name ?? ""}
          className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-[var(--text-strong)]">Description</span>
        <textarea
          name="description"
          rows={3}
          placeholder="Brief description of this service type"
          defaultValue={values?.description ?? ""}
          className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-[var(--text-strong)]">Icon (emoji or text)</span>
          <input
            name="icon"
            type="text"
            placeholder="🚗 or CW"
            maxLength={4}
            defaultValue={values?.icon ?? ""}
            className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
          />
        </label>

        <div className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-[var(--text-strong)]">Color</span>
          <div className="flex items-center gap-2">
            <input
              name="color"
              type="color"
              defaultValue={values?.color ?? "#3B82F6"}
              className="h-10 w-14 cursor-pointer rounded-lg border border-[var(--surface-border)]"
            />
            <div className="flex flex-wrap gap-1">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={(e) => {
                    const input = e.currentTarget.parentElement?.parentElement?.querySelector(
                      'input[name="color"]'
                    ) as HTMLInputElement;
                    if (input) input.value = color;
                  }}
                  className="h-6 w-6 rounded border border-white/20 transition hover:scale-110"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-[var(--text-strong)]">Sort Order</span>
        <input
          name="sortOrder"
          type="number"
          min={0}
          defaultValue={values?.sortOrder ?? 0}
          className="w-32 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
        />
        <p className="text-xs text-[var(--text-muted)]">
          Lower numbers appear first in the list
        </p>
      </label>

      {/* Attributes Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-[var(--text-strong)]">Service Attributes</span>
            <p className="text-xs text-[var(--text-muted)]">
              Define custom attributes for services of this type (e.g., Car Types, Add-ons)
            </p>
          </div>
          <button
            type="button"
            onClick={addAttribute}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--text-strong)] hover:bg-[var(--surface-border)]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Attribute
          </button>
        </div>

        {attributes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--surface-border)] bg-[var(--surface-secondary)]/50 p-4 text-center">
            <p className="text-sm text-[var(--text-muted)]">
              No attributes defined. Add attributes to customize service options.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {attributes.map((attr, attrIndex) => (
              <div
                key={attrIndex}
                className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2 text-[var(--text-muted)]">
                    <GripVertical className="h-4 w-4" />
                    <span className="text-xs font-medium">Attribute {attrIndex + 1}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttribute(attrIndex)}
                    className="rounded p-1 text-[var(--text-muted)] hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="text-xs font-medium text-[var(--text-label)]">Attribute Name</span>
                    <input
                      type="text"
                      value={attr.name}
                      onChange={(e) => updateAttribute(attrIndex, { name: e.target.value })}
                      placeholder="e.g., Available Car Types"
                      className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="text-xs font-medium text-[var(--text-label)]">Type</span>
                    <select
                      value={attr.type}
                      onChange={(e) =>
                        updateAttribute(attrIndex, {
                          type: e.target.value as "text" | "select" | "checkbox",
                        })
                      }
                      className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                    >
                      <option value="checkbox">Checkbox (multi-select)</option>
                      <option value="select">Dropdown (single-select)</option>
                      <option value="text">Text input</option>
                    </select>
                  </label>
                </div>

                {(attr.type === "checkbox" || attr.type === "select") && (
                  <div className="space-y-3">
                    <span className="text-xs font-medium text-[var(--text-label)]">Options</span>
                    <div className="space-y-2">
                      {attr.options?.map((option, optIndex) => {
                        const normalizedOption = normalizeAttributeOption(option);
                        return (
                        <div
                          key={optIndex}
                          className="grid gap-2 rounded-lg border border-[var(--surface-border)] bg-white p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                        >
                          <label className="flex flex-col gap-1 text-xs">
                            <span className="text-[var(--text-label)]">Label</span>
                            <input
                              type="text"
                              value={normalizedOption.label}
                              onChange={(e) =>
                                updateOption(attrIndex, optIndex, { label: e.target.value })
                              }
                              className="rounded-lg border border-[var(--surface-border)] bg-white px-2 py-1.5 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-xs">
                            <span className="inline-flex items-center gap-1 text-[var(--text-label)]">
                              <ImageIcon className="h-3 w-3" />
                              Image URL (optional)
                            </span>
                            <input
                              type="url"
                              value={normalizedOption.imageUrl ?? ""}
                              onChange={(e) =>
                                updateOption(attrIndex, optIndex, {
                                  imageUrl: e.target.value || undefined,
                                })
                              }
                              className="rounded-lg border border-[var(--surface-border)] bg-white px-2 py-1.5 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                              placeholder="https://example.com/image.png"
                            />
                          </label>
                          <div className="flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => removeOption(attrIndex, optIndex)}
                              className="rounded-full border border-red-100 p-2 text-red-500 transition hover:bg-red-50"
                              aria-label="Remove option"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                    <div className="grid gap-2 rounded-lg border border-dashed border-[var(--surface-border)] bg-[var(--surface-secondary)]/30 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                      <label className="flex flex-col gap-1 text-xs">
                        <span className="text-[var(--text-label)]">Label</span>
                        <input
                          type="text"
                          value={newOptionInputs[attrIndex]?.label ?? ""}
                          onChange={(e) =>
                            setNewOptionInputs({
                              ...newOptionInputs,
                              [attrIndex]: {
                                ...(newOptionInputs[attrIndex] ?? {}),
                                label: e.target.value,
                              },
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addOption(attrIndex);
                            }
                          }}
                          placeholder="e.g., Sedan, SUV"
                          className="rounded-lg border border-[var(--surface-border)] bg-white px-2 py-1.5 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs">
                        <span className="inline-flex items-center gap-1 text-[var(--text-label)]">
                          <LinkIcon className="h-3 w-3" />
                          Image URL
                        </span>
                        <input
                          type="url"
                          value={newOptionInputs[attrIndex]?.imageUrl ?? ""}
                          onChange={(e) =>
                            setNewOptionInputs({
                              ...newOptionInputs,
                              [attrIndex]: {
                                ...(newOptionInputs[attrIndex] ?? {}),
                                imageUrl: e.target.value,
                              },
                            })
                          }
                          placeholder="https://example.com/image.png"
                          className="rounded-lg border border-[var(--surface-border)] bg-white px-2 py-1.5 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                        />
                      </label>
                      <div className="flex items-end justify-end">
                        <button
                          type="button"
                          onClick={() => addOption(attrIndex)}
                          className="rounded-lg bg-[var(--surface-secondary)] px-3 py-1.5 text-xs font-semibold text-[var(--text-strong)] hover:bg-[var(--surface-border)]"
                        >
                          Add option
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={attr.required ?? false}
                    onChange={(e) => updateAttribute(attrIndex, { required: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                  />
                  <span className="text-xs text-[var(--text-muted)]">Required attribute</span>
                </label>
              </div>
            ))}
          </div>
        )}
      </div>

      <label className="flex items-center gap-3 text-sm">
        <input
          name="active"
          type="checkbox"
          defaultChecked={values?.active ?? true}
          className="h-4 w-4 rounded border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
        />
        <span className="text-[var(--text-strong)]">Service type is active</span>
      </label>

      <div className="flex items-center gap-3 pt-4">
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
