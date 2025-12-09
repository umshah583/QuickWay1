'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';

interface DriverDay {
  id: string;
  driverId: string;
  driver: {
    id: string;
    name: string | null;
    email: string | null;
  };
  date: string;
  status: 'OPEN' | 'CLOSED';
  startedAt: string;
  endedAt: string | null;
  tasksCompleted: number;
  tasksInProgress: number;
  cashCollectedCents: number;
  cashSettledCents: number;
  startNotes: string | null;
  endNotes: string | null;
}

export default function DriverDaysAdmin() {
  const [driverDays, setDriverDays] = useState<DriverDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [resetting, setResetting] = useState<string | null>(null);

  const fetchDriverDays = useCallback(async () => {
    try {
      const status = filter === 'all' ? undefined : filter.toUpperCase();
      const url = status ? `/api/admin/driver-days?status=${status}` : '/api/admin/driver-days';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setDriverDays(data.driverDays);
      }
    } catch (error) {
      console.error('Failed to fetch driver days:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchDriverDays();
  }, [fetchDriverDays]);

  const handleResetDayEnd = async (driverDayId: string) => {
    if (!confirm('Are you sure you want to reset this driver\'s day end? This will allow them to start a new shift for today.')) {
      return;
    }

    setResetting(driverDayId);
    try {
      const response = await fetch('/api/admin/driver-days', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          driverDayId,
          action: 'reset_end'
        })
      });

      if (response.ok) {
        alert('Driver day end has been reset successfully!');
        fetchDriverDays(); // Refresh the list
      } else {
        const error = await response.json();
        alert(`Failed to reset day end: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to reset day end:', error);
      alert('Failed to reset day end. Please try again.');
    } finally {
      setResetting(null);
    }
  };

  const formatCurrency = (cents: number) => {
    return `AED ${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Driver Days Management</h1>

        {/* Filter */}
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'open' | 'closed')}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">All Days</option>
            <option value="open">Active Days</option>
            <option value="closed">Ended Days</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900">Total Days</h3>
          <p className="text-3xl font-bold text-blue-600">{driverDays.length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900">Active Today</h3>
          <p className="text-3xl font-bold text-green-600">
            {driverDays.filter(d => d.status === 'OPEN' && new Date(d.date).toDateString() === new Date().toDateString()).length}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900">Ended Today</h3>
          <p className="text-3xl font-bold text-red-600">
            {driverDays.filter(d => d.status === 'CLOSED' && new Date(d.date).toDateString() === new Date().toDateString()).length}
          </p>
        </div>
      </div>

      {/* Driver Days List */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            {filter === 'all' ? 'All Driver Days' : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Days`}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Driver
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Started
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ended
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tasks
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cash Collected
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {driverDays.map((day) => (
                <tr key={day.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {day.driver.name || 'Unknown Driver'}
                      </div>
                      <div className="text-sm text-gray-500">{day.driver.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {format(new Date(day.date), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      day.status === 'OPEN'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {day.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {format(new Date(day.startedAt), 'HH:mm')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {day.endedAt ? format(new Date(day.endedAt), 'HH:mm') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {day.tasksCompleted} completed, {day.tasksInProgress} in progress
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(day.cashCollectedCents)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {day.status === 'CLOSED' && (
                      <button
                        onClick={() => handleResetDayEnd(day.id)}
                        disabled={resetting === day.id}
                        className="text-blue-600 hover:text-blue-900 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {resetting === day.id ? 'Resetting...' : 'Reset End'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {driverDays.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No driver days found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
