import { getServerSession } from "next-auth";
import Image from "next/image";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { updateAdminProfile } from "./actions";

type SearchParams = {
  status?: string;
  error?: string;
};

export default async function AdminProfilePage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("Admin session missing");
  }

  const adminUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      phoneNumber: true,
      image: true,
    },
  });

  if (!adminUser) {
    throw new Error("Admin user not found");
  }

  const resolvedParams = await searchParams;
  const successMessage = resolvedParams?.status;
  const errorMessage = resolvedParams?.error;

  return (
    <div className="space-y-8">
      <header className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-7 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--text-muted)]">Admin profile</p>
            <h1 className="mt-2 text-3xl font-semibold text-[var(--text-strong)]">Your personal settings</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Update how you appear across the dashboard and provide a hosted image URL for your avatar.
            </p>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-[var(--surface-border)] bg-white/50 px-5 py-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-full border border-[var(--surface-border)]">
              {adminUser.image ? (
                <Image src={adminUser.image} alt="Profile preview" fill sizes="64px" className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[var(--brand-primary)] text-xl font-semibold text-white">
                  {(adminUser.name ?? "Admin").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">Signed in as</p>
              <p className="text-lg font-semibold text-[var(--text-strong)]">{adminUser.name ?? "Admin User"}</p>
              <p className="text-sm text-[var(--text-muted)]">{adminUser.email ?? "email not set"}</p>
            </div>
          </div>
        </div>
      </header>

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {successMessage}
        </div>
      ) : null}
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{errorMessage}</div>
      ) : null}

      <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-7 shadow-sm">
        <form action={updateAdminProfile} className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-[var(--text-strong)]">Full name</span>
              <input
                type="text"
                name="name"
                required
                defaultValue={adminUser.name ?? ""}
                className="h-11 rounded-xl border border-[var(--surface-border)] bg-white px-4 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                placeholder="Jane Admin"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-[var(--text-strong)]">Email</span>
              <input
                type="email"
                name="email"
                required
                defaultValue={adminUser.email ?? ""}
                className="h-11 rounded-xl border border-[var(--surface-border)] bg-white px-4 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                placeholder="admin@example.com"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-[var(--text-strong)]">Phone number</span>
              <input
                type="tel"
                name="phoneNumber"
                defaultValue={adminUser.phoneNumber ?? ""}
                className="h-11 rounded-xl border border-[var(--surface-border)] bg-white px-4 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                placeholder="+971 50 123 4567"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-[var(--text-strong)]">Profile image URL</span>
              <input
                type="url"
                name="profileImage"
                defaultValue={adminUser.image ?? ""}
                className="h-11 rounded-xl border border-[var(--surface-border)] bg-white px-4 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                placeholder="https://cdn.example.com/avatar.jpg"
              />
              <span className="text-xs text-[var(--text-muted)]">Paste a link to an image hosted on a secure (HTTPS) URL.</span>
            </label>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-[var(--surface-border)] bg-white/40 px-4 py-4 text-sm text-[var(--text-muted)] md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium text-[var(--text-strong)]">Need an image?</p>
              <p>Upload your avatar to any CDN (e.g., Cloudinary, Imgur, S3) and paste the public link here.</p>
            </div>
            <a
              href="https://cloudinary.com/users/register/free"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-[var(--brand-primary)] transition hover:bg-[var(--brand-primary)]/10"
            >
              Open Cloudinary
            </a>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-secondary)]"
            >
              Save profile
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
