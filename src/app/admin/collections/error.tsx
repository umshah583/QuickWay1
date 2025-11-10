"use client";

export default function AdminCollectionsError({ error }: { error: Error & { digest?: string } }) {
  console.error(error);
  return (
    <div className="space-y-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
      <h2 className="text-lg font-semibold">Something went wrong while loading collections.</h2>
      <p className="text-sm opacity-90">Please refresh the page. If the issue persists, contact support with the error details.</p>
    </div>
  );
}
