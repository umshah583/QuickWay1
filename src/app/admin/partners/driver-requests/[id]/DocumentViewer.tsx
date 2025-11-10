"use client";

import { useState } from "react";
import Link from "next/link";

export type DocumentItem = {
  label: string;
  href: string;
};

type DocumentViewerProps = {
  documents: DocumentItem[];
};

export default function DocumentViewer({ documents }: DocumentViewerProps) {
  const [activeDoc, setActiveDoc] = useState<DocumentItem | null>(null);

  if (documents.length === 0) {
    return <p className="text-sm text-black/60">No documents uploaded.</p>;
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2 text-sm text-black/60">
        {documents.map((document) => (
          <li key={document.href}>
            <button
              type="button"
              onClick={() => setActiveDoc(document)}
              className="inline-flex items-center gap-2 font-semibold text-[var(--brand-primary)] underline decoration-solid transition hover:text-[var(--brand-secondary)]"
            >
              {document.label}
            </button>
          </li>
        ))}
      </ul>

      {activeDoc ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8">
          <div className="relative flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-[var(--surface-border)] px-4 py-3">
              <h3 className="text-sm font-semibold text-[var(--text-strong)]">{activeDoc.label}</h3>
              <div className="flex items-center gap-2">
                <Link
                  href={`${activeDoc.href}?download=1`}
                  download
                  className="inline-flex items-center justify-center rounded-full border border-[var(--brand-primary)] px-4 py-1.5 text-xs font-semibold text-[var(--brand-primary)] transition hover:bg-[var(--brand-primary)] hover:text-white"
                >
                  Download
                </Link>
                <button
                  type="button"
                  onClick={() => setActiveDoc(null)}
                  className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs font-semibold text-[var(--text-strong)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                >
                  Close
                </button>
              </div>
            </header>
            <div className="flex-1 overflow-hidden bg-black/5">
              <iframe src={activeDoc.href} className="h-full w-full" title={activeDoc.label} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
