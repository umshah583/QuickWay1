"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteServiceType } from "./actions";

type Props = {
  id: string;
  name: string;
  servicesCount: number;
};

export default function DeleteServiceTypeButton({ id, name, servicesCount }: Props) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (servicesCount > 0) {
      setError(`Cannot delete: ${servicesCount} services are using this type. Reassign them first.`);
      return;
    }

    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      await deleteServiceType(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setIsDeleting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        title={servicesCount > 0 ? `Cannot delete: ${servicesCount} services using this type` : "Delete"}
      >
        <Trash2 className="h-4 w-4" />
      </button>
      {error && (
        <div className="absolute right-0 top-full z-10 mt-1 w-64 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700 shadow-lg">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 font-medium underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
