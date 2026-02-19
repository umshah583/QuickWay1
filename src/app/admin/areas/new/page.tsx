import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import AreaForm from '../AreaForm';

export default function NewAreaPage() {
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
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">New Service Area</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Create a new geographic zone for location-based pricing
          </p>
        </div>
      </div>

      <AreaForm />
    </div>
  );
}
