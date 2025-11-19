import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Package } from "lucide-react";

export const dynamic = "force-dynamic";

async function createPackage(formData: FormData) {
  "use server";

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const duration = formData.get("duration") as string;
  const washesPerMonth = parseInt(formData.get("washesPerMonth") as string);
  const priceAED = parseFloat(formData.get("price") as string);
  const discountPercent = parseInt(formData.get("discountPercent") as string) || 0;
  const popular = formData.get("popular") === "on";
  const status = formData.get("status") as string;
  const features = formData.getAll("features") as string[];
  
  await (prisma as any).monthlyPackage.create({
    data: {
      name,
      description,
      duration: duration as any,
      washesPerMonth,
      priceCents: Math.round(priceAED * 100),
      discountPercent,
      popular,
      status: status as any,
      features: features.filter(f => f.trim()),
      serviceIds: [], // Can be enhanced to select services
    },
  });

  redirect("/admin/packages");
}

export default async function NewPackagePage() {
  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Create New Package</h1>
        <p className="text-sm text-[var(--text-muted)]">Set up a new monthly subscription package</p>
      </div>

      {/* Form */}
      <form action={createPackage} className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-[var(--text-strong)] mb-2">
                Package Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                placeholder="e.g., Premium Monthly Plan"
                className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--surface)] px-4 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              />
            </div>

            <div>
              <label htmlFor="duration" className="block text-sm font-medium text-[var(--text-strong)] mb-2">
                Duration *
              </label>
              <select
                id="duration"
                name="duration"
                required
                className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--surface)] px-4 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              >
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly (3 months)</option>
                <option value="YEARLY">Yearly (12 months)</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-[var(--text-strong)] mb-2">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Brief description of the package benefits"
              className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--surface)] px-4 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            />
          </div>

          {/* Pricing */}
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <label htmlFor="washesPerMonth" className="block text-sm font-medium text-[var(--text-strong)] mb-2">
                Washes Per Month *
              </label>
              <input
                type="number"
                id="washesPerMonth"
                name="washesPerMonth"
                required
                min="1"
                placeholder="e.g., 8"
                className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--surface)] px-4 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              />
            </div>

            <div>
              <label htmlFor="price" className="block text-sm font-medium text-[var(--text-strong)] mb-2">
                Price (AED) *
              </label>
              <input
                type="number"
                id="price"
                name="price"
                required
                min="0"
                step="0.01"
                placeholder="e.g., 299.00"
                className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--surface)] px-4 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              />
            </div>

            <div>
              <label htmlFor="discountPercent" className="block text-sm font-medium text-[var(--text-strong)] mb-2">
                Discount %
              </label>
              <input
                type="number"
                id="discountPercent"
                name="discountPercent"
                min="0"
                max="100"
                placeholder="e.g., 20"
                className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--surface)] px-4 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              />
            </div>
          </div>

          {/* Features */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-strong)] mb-2">
              Features (one per line)
            </label>
            <div className="space-y-2">
              {[...Array(5)].map((_, idx) => (
                <input
                  key={idx}
                  type="text"
                  name="features"
                  placeholder={`Feature ${idx + 1}`}
                  className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--surface)] px-4 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                />
              ))}
            </div>
          </div>

          {/* Status & Popular */}
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-[var(--text-strong)] mb-2">
                Status *
              </label>
              <select
                id="status"
                name="status"
                required
                defaultValue="ACTIVE"
                className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--surface)] px-4 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="popular"
                  className="h-5 w-5 rounded border-[var(--card-border)] text-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                />
                <span className="text-sm font-medium text-[var(--text-strong)]">Mark as Popular</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 border-t border-[var(--card-border)] pt-6">
            <a
              href="/admin/packages"
              className="rounded-lg border border-[var(--card-border)] px-4 py-2 text-sm font-medium text-[var(--text-medium)] hover:bg-[var(--hover-bg)] transition-colors"
            >
              Cancel
            </a>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
            >
              <Package className="h-4 w-4" />
              Create Package
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
