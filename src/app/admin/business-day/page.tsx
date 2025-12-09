"use client";

import { useEffect, useState } from "react";

type BusinessHoursData = {
  businessHours?: {
    id: string;
    startTime: string; // e.g., "09:00"
    endTime: string; // e.g., "17:00"
    durationHours: number;
    isActive: boolean;
    setBy: { id: string; name: string };
    setAt: string;
    notes?: string;
  };
};

export default function BusinessDayPage() {
  const [data, setData] = useState<BusinessHoursData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state for setting business hours
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [durationHours, setDurationHours] = useState(8);
  const [notes, setNotes] = useState("");

  const fetchBusinessHours = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/business-hours");
      if (!response.ok) {
        throw new Error("Failed to fetch business hours");
      }
      const result = await response.json();
      setData(result);

      // Set form values from existing data
      if (result.businessHours) {
        setStartTime(result.businessHours.startTime);
        setEndTime(result.businessHours.endTime);
        setDurationHours(result.businessHours.durationHours);
        setNotes(result.businessHours.notes || "");
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const updateBusinessHours = async () => {
    try {
      setActionLoading(true);
      const response = await fetch("/api/business-hours", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startTime,
          endTime,
          durationHours,
          notes: notes.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update business hours");
      }

      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update business hours");
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinessHours();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Business Hours Configuration</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800">{error}</div>
        </div>
      )}

      {/* Current Business Hours Display */}
      {data?.businessHours && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Business Hours</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Start Time</label>
              <p className="text-lg font-mono text-gray-900">{data.businessHours.startTime}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">End Time</label>
              <p className="text-lg font-mono text-gray-900">{data.businessHours.endTime}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Duration</label>
              <p className="text-lg font-mono text-gray-900">{data.businessHours.durationHours} hours</p>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
              data.businessHours.isActive
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-800"
            }`}>
              {data.businessHours.isActive ? "Active" : "Inactive"}
            </span>
          </div>
          {data.businessHours.notes && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <p className="text-gray-900">{data.businessHours.notes}</p>
            </div>
          )}
          <div className="mt-4 text-sm text-gray-500">
            Set by {data.businessHours.setBy.name} on {new Date(data.businessHours.setAt).toLocaleString()}
          </div>
        </div>
      )}

      {/* Business Hours Configuration Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Update Business Hours</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-1">
              Start Time
            </label>
            <input
              type="time"
              id="startTime"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            />
          </div>
          <div>
            <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-1">
              End Time
            </label>
            <input
              type="time"
              id="endTime"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            />
          </div>
          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
              Duration (hours)
            </label>
            <select
              id="duration"
              value={durationHours}
              onChange={(e) => setDurationHours(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            >
              {[2, 4, 6, 8, 10, 12, 16, 20, 24].map(hours => (
                <option key={hours} value={hours}>{hours} hours</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mb-4">
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            placeholder="Add any notes about the business hours..."
          />
        </div>
        <button
          onClick={updateBusinessHours}
          disabled={actionLoading}
          className="px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {actionLoading ? "Updating..." : "Update Business Hours"}
        </button>
      </div>
    </div>
  );
}
