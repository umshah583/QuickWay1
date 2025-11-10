'use client';

import { useState } from 'react';

type PrintButtonProps = {
  className?: string;
};

export function PrintButton({ className }: PrintButtonProps) {
  const [printing, setPrinting] = useState(false);

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 0);
  };

  return (
    <button
      type="button"
      onClick={handlePrint}
      className={`inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-4 py-2 text-sm font-medium text-[var(--text-strong)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] ${
        printing ? 'opacity-60' : ''
      } ${className ?? ''}`}
      disabled={printing}
    >
      {printing ? 'Preparing…' : 'Print invoice'}
    </button>
  );
}
