import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Package } from "lucide-react";

type PackageDuration = "MONTHLY" | "QUARTERLY" | "YEARLY";
type PackageStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

type PrismaWithPackages = typeof prisma & {
  monthlyPackage: {
    findUnique: (args: unknown) => Promise<any>;
    update: (args: unknown) => Promise<unknown>;
  };
};

const packagesDb = prisma as PrismaWithPackages;

export const dynamic = "force-dynamic";

async function updatePackage(formData: FormData) {
  "use server";

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const duration = formData.get("duration") as PackageDuration;
  const washesPerMonth = parseInt(formData.get("washesPerMonth") as string);
  const priceAED = parseFloat(formData.get("price") as string);
  const discountPercent = parseInt(formData.get("discountPercent") as string) || 0;
  const popular = formData.get("popular") === "on";
  const status = formData.get("status") as PackageStatus;
  const features = formData.getAll("features") as string[];

  await packagesDb.monthlyPackage.update({
    where: { id },
    data: {
      name,
      description,
      duration,
      washesPerMonth,
      priceCents: Math.round(priceAED * 100),
      discountPercent,
      popular,
      status,
      features: features.map(f => f.trim()).filter(f => f.length > 0),
    },
  });

  redirect("/admin/packages");
}

export default async function EditPackagePage({ params }: { params: { id: string } }) {
  const pkg = await packagesDb.monthlyPackage.findUnique({
    where: { id: params.id },
  });

  if (!pkg) {
    notFound();
  }

  const priceAED = (pkg.priceCents / 100).toFixed(2);
  const features: string[] = Array.isArray(pkg.features) ? pkg.features : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Edit Package</h1>
        <p className="text-sm text-[var(--text-muted)]">Update details for this subscription package</p>
      </div>

      <form action={updatePackage} className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
        <input type="hidden" name="id" value={pkg.id} />
        <div className="space-y-6">
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
                defaultValue={pkg.name}
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
                defaultValue={pkg.duration}
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
              defaultValue={pkg.description ?? ""}
              className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--surface)] px-4 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            />
          </div>

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
                min={1}
                defaultValue={pkg.washesPerMonth}
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
                min={0}
                step="0.01"
                defaultValue={priceAED}
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
                min={0}
                max={100}
                defaultValue={pkg.discountPercent ?? 0}
                className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--surface)] px-4 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-strong)] mb-2">Features (one per line)</label>
            <div className="space-y-2">
              {[...Array(5)].map((_, idx) => (
                <input
                  key={idx}
                  type="text"
                  name="features"
                  defaultValue={features[idx] ?? ""}
                  className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--surface)] px-4 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                />
              ))}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-[var(--text-strong)] mb-2">
                Status *
              </label>
              <select
                id="status"
                name="status"
                required
                defaultValue={pkg.status}
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
                  defaultChecked={pkg.popular}
                  className="h-5 w-5 rounded border-[var(--card-border)] text-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                />
                <span className="text-sm font-medium text-[var(--text-strong)]">Mark as Popular</span>
              </label>
            </div>
          </div>

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
              Save Changes
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
