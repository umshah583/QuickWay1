import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import EditPartnerForm from "./partner-form";

export const dynamic = "force-dynamic";

const objectIdRegex = /^[a-f\d]{24}$/i;

export default async function AdminPartnerEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!objectIdRegex.test(id)) {
    notFound();
  }

  const partner = await prisma.partner.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!partner) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-strong)]">Edit partner</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Update partner details or remove the partner from your network.
          </p>
        </div>
        <Link
          href={`/admin/partners/${partner.id}`}
          className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-4 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
        >
          Back to overview
        </Link>
      </header>

      <EditPartnerForm partner={partner} />
    </div>
  );
}
