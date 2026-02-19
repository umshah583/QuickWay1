'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteArea } from './actions';

interface DeleteAreaButtonProps {
  id: string;
  name: string;
  bookingsCount: number;
}

export default function DeleteAreaButton({ id, name, bookingsCount }: DeleteAreaButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const formData = new FormData();
      formData.append('id', id);
      await deleteArea(formData);
    } catch (error) {
      console.error('Failed to delete area:', error);
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  if (bookingsCount > 0) {
    return (
      <button
        disabled
        title={`Cannot delete: ${bookingsCount} bookings use this area`}
        className="rounded-lg p-2 text-gray-300 cursor-not-allowed"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-[var(--surface)] p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[var(--text-strong)]">Delete Area</h3>
            <p className="mt-2 text-sm text-[var(--text-medium)]">
              Are you sure you want to delete <strong>{name}</strong>? This will also delete all
              associated service area prices. This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isDeleting}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--text-medium)] hover:bg-[var(--surface-secondary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
