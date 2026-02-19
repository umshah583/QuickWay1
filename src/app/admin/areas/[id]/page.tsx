import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import AreaForm from '../AreaForm';

export const dynamic = 'force-dynamic';

interface EditAreaPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditAreaPage({ params }: EditAreaPageProps) {
  const { id } = await params;
  
  const area = await prisma.area.findUnique({
    where: { id },
  });

  if (!area) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/areas"
          className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-secondary)] hover:text-[var(--text-strong)]"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Edit Area: {area.name}</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Update geographic zone settings and boundaries
          </p>
        </div>
      </div>

      <AreaForm area={area} />
    </div>
  );
}
