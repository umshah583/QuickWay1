'use client';

import { useState } from 'react';

export default function PromotionalNotificationsPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [appType, setAppType] = useState<'CUSTOMER' | 'DRIVER'>('CUSTOMER');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; sentCount?: number; failedCount?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/admin/promotional-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, appType }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Send Promotional Notifications</h1>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-medium mb-1">App Type</label>
          <select
            value={appType}
            onChange={(e) => setAppType(e.target.value as 'CUSTOMER' | 'DRIVER')}
            className="w-full border rounded px-3 py-2"
          >
            <option value="CUSTOMER">Customer App</option>
            <option value="DRIVER">Driver App</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Message Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            rows={4}
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Sending...' : 'Send Broadcast Notification'}
        </button>
      </form>

      {result && (
        <div className="mt-6 p-4 bg-green-100 border border-green-300 rounded">
          <p className="font-medium">Notification sent successfully!</p>
          <p>Sent to {result.sentCount} devices, {result.failedCount} failed.</p>
        </div>
      )}

      {error && (
        <div className="mt-6 p-4 bg-red-100 border border-red-300 rounded">
          <p className="font-medium">Error sending notification:</p>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
