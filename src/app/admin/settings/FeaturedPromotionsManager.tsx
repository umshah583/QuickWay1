"use client";

import { useState } from "react";
import type { FeaturedPromotionSetting } from "./pricingConstants";

async function fetchJson(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }
  return res.json();
}

type FeaturedPromotionsManagerProps = {
  initialItems: FeaturedPromotionSetting[];
};

export default function FeaturedPromotionsManager({ initialItems }: FeaturedPromotionsManagerProps) {
  const [items, setItems] = useState<FeaturedPromotionSetting[]>(initialItems);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formState, setFormState] = useState<FeaturedPromotionSetting | null>(null);
  const [saving, setSaving] = useState(false);

  const openCreateModal = () => {
    setEditingIndex(null);
    setFormState({
      title: "",
      description: "",
      savingsLabel: "",
      ctaLabel: undefined,
      ctaLink: undefined,
      serviceId: undefined,
      imageUrl: undefined,
      textColorScheme: "light",
      titleColor: "#FFFFFF",
      descriptionColor: "#E5E7EB",
      savingsColor: "#38BDF8",
      ctaColor: "#FFFFFF",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (index: number) => {
    const existing = items[index];
    setEditingIndex(index);
    setFormState({
      ...existing,
      textColorScheme: existing.textColorScheme ?? "light",
      titleColor: existing.titleColor ?? "#FFFFFF",
      descriptionColor: existing.descriptionColor ?? "#E5E7EB",
      savingsColor: existing.savingsColor ?? "#38BDF8",
      ctaColor: existing.ctaColor ?? "#FFFFFF",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormState(null);
    setEditingIndex(null);
  };

  const handleChange = (field: keyof FeaturedPromotionSetting, value: string) => {
    setFormState((prev) =>
      prev
        ? {
            ...prev,
            [field]: value,
          }
        : prev,
    );
  };

  const handleSave = async () => {
    if (!formState) return;
    if (!formState.title.trim() || !formState.description.trim() || !formState.savingsLabel.trim()) {
      alert("Title, description, and savings label are required.");
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<FeaturedPromotionSetting> = {
        title: formState.title.trim(),
        description: formState.description.trim(),
        savingsLabel: formState.savingsLabel.trim(),
        ctaLabel: formState.ctaLabel?.trim() || undefined,
        ctaLink: formState.ctaLink?.trim() || undefined,
        serviceId: formState.serviceId?.trim() || undefined,
        imageUrl: formState.imageUrl?.trim() || undefined,
        textColorScheme: formState.textColorScheme === "dark" ? "dark" : "light",
        titleColor: formState.titleColor?.trim() || undefined,
        descriptionColor: formState.descriptionColor?.trim() || undefined,
        savingsColor: formState.savingsColor?.trim() || undefined,
        ctaColor: formState.ctaColor?.trim() || undefined,
      };

      let data: { items: FeaturedPromotionSetting[] };
      if (editingIndex === null) {
        // Create
        data = await fetchJson("/api/admin/featured-promotions", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      } else {
        // Update
        data = await fetchJson("/api/admin/featured-promotions", {
          method: "PUT",
          body: JSON.stringify({ index: editingIndex, data: payload }),
        });
      }

      setItems(data.items || []);
      closeModal();
    } catch (error) {
      console.error("Failed to save promotion", error);
      alert("Failed to save promotion. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (index: number) => {
    if (!confirm("Delete this featured promotion? This cannot be undone.")) return;

    try {
      const data = await fetchJson("/api/admin/featured-promotions", {
        method: "DELETE",
        body: JSON.stringify({ index }),
      });
      setItems(data.items || []);
    } catch (error) {
      console.error("Failed to delete promotion", error);
      alert("Failed to delete promotion. Please try again.");
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--surface-border)] bg-white/60 p-4">
      <header className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-[var(--text-strong)]">Featured promotions</h3>
          <p className="text-sm text-[var(--text-muted)]">
            Manage the cards that appear in the mobile &quot;Featured&quot; carousel. You can add, edit, or remove promotions at any time.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)]"
        >
          + Add featured promotion
        </button>
      </header>

      {items.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No featured promotions configured yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--surface-border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Savings</th>
                <th className="px-4 py-3">Image</th>
                <th className="px-4 py-3">Text style</th>
                <th className="px-4 py-3">Service ID</th>
                <th className="px-4 py-3">CTA</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={`${item.title}-${index}`} className="border-t border-[var(--surface-border)]">
                  <td className="px-4 py-3">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-[var(--text-strong)]">{item.title}</p>
                      <p className="line-clamp-2 text-xs text-[var(--text-muted)]">{item.description}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text-strong)]">{item.savingsLabel}</td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)] truncate max-w-[10rem]">
                    {item.imageUrl || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                    {item.textColorScheme === "dark" ? "Dark" : "Light"}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{item.serviceId || "—"}</td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{item.ctaLabel || "View"}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(index)}
                      className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(index)}
                      className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && formState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-[var(--surface-border)] bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-lg font-semibold text-[var(--text-strong)]">
                {editingIndex === null ? "Add featured promotion" : "Edit featured promotion"}
              </h4>
              <button
                type="button"
                onClick={closeModal}
                className="text-xl text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-[var(--text-strong)]">Title</span>
                <input
                  type="text"
                  value={formState.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  className="h-10 rounded-lg border border-[var(--surface-border)] px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                />
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span>Title color</span>
                  <input
                    type="color"
                    value={formState.titleColor ?? "#FFFFFF"}
                    onChange={(e) => handleChange("titleColor", e.target.value)}
                    className="h-8 w-12 cursor-pointer rounded border border-[var(--surface-border)] bg-transparent p-0"
                  />
                </div>
              </label>

              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-[var(--text-strong)]">Description</span>
                <textarea
                  value={formState.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  rows={3}
                  className="rounded-lg border border-[var(--surface-border)] px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                />
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span>Description color</span>
                  <input
                    type="color"
                    value={formState.descriptionColor ?? "#E5E7EB"}
                    onChange={(e) => handleChange("descriptionColor", e.target.value)}
                    className="h-8 w-12 cursor-pointer rounded border border-[var(--surface-border)] bg-transparent p-0"
                  />
                </div>
              </label>

              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-[var(--text-strong)]">Savings label</span>
                <input
                  type="text"
                  value={formState.savingsLabel}
                  onChange={(e) => handleChange("savingsLabel", e.target.value)}
                  placeholder="Only AED 99"
                  className="h-10 rounded-lg border border-[var(--surface-border)] px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                />
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span>Savings text color</span>
                  <input
                    type="color"
                    value={formState.savingsColor ?? "#38BDF8"}
                    onChange={(e) => handleChange("savingsColor", e.target.value)}
                    className="h-8 w-12 cursor-pointer rounded border border-[var(--surface-border)] bg-transparent p-0"
                  />
                </div>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm">
                  <span className="font-medium text-[var(--text-strong)]">CTA label</span>
                  <input
                    type="text"
                    value={formState.ctaLabel ?? ""}
                    onChange={(e) => handleChange("ctaLabel", e.target.value)}
                    placeholder="Book now"
                    className="h-10 rounded-lg border border-[var(--surface-border)] px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                  />
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <span>CTA text color</span>
                    <input
                      type="color"
                      value={formState.ctaColor ?? "#FFFFFF"}
                      onChange={(e) => handleChange("ctaColor", e.target.value)}
                      className="h-8 w-12 cursor-pointer rounded border border-[var(--surface-border)] bg-transparent p-0"
                    />
                  </div>
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  <span className="font-medium text-[var(--text-strong)]">CTA link or Service ID</span>
                  <input
                    type="text"
                    value={formState.ctaLink ?? ""}
                    onChange={(e) => handleChange("ctaLink", e.target.value)}
                    placeholder="Service ID or external URL"
                    className="h-10 rounded-lg border border-[var(--surface-border)] px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-[var(--text-strong)]">Link to service (optional)</span>
                <input
                  type="text"
                  value={formState.serviceId ?? ""}
                  onChange={(e) => handleChange("serviceId", e.target.value)}
                  placeholder="Paste service ID to pre-select it in mobile app"
                  className="h-10 rounded-lg border border-[var(--surface-border)] px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-[var(--text-strong)]">Image URL (optional)</span>
                <input
                  type="text"
                  value={formState.imageUrl ?? ""}
                  onChange={(e) => handleChange("imageUrl", e.target.value)}
                  placeholder="https://example.com/promo.jpg"
                  className="h-10 rounded-lg border border-[var(--surface-border)] px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-[var(--text-strong)]">Text color style</span>
                <select
                  value={formState.textColorScheme ?? "light"}
                  onChange={(e) => handleChange("textColorScheme", e.target.value)}
                  className="h-10 rounded-lg border border-[var(--surface-border)] px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                >
                  <option value="light">Light (for dark images)</option>
                  <option value="dark">Dark (for light images)</option>
                </select>
              </label>

              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-full border border-[var(--surface-border)] px-5 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-full bg-[var(--brand-primary)] px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)] disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save promotion"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
