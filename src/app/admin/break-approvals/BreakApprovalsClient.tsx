"use client";

import { useState, useEffect } from "react";

type Driver = {
  id: string;
  name: string | null;
  email: string;
};

type DriverDay = {
  id: string;
  date: string;
  status: string;
};

type BreakRequest = {
  id: string;
  driverId: string;
  driverDayId: string;
  reason: string;
  reasonDisplay: string;
  notes: string | null;
  requestedDuration: number | null;
  totalBreakTimeToday: number;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  User: Driver;
  DriverDay: DriverDay;
  todayBreakStats: {
    totalBreaks: number;
    totalBreakTime: number;
    maxAllowedTime: number;
    remainingTime: number;
  };
};

type ApiResponse = {
  success: boolean;
  requests: BreakRequest[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  filters: { status: string };
  timestamp: string;
};

export default function BreakApprovalsClient() {
  const [requests, setRequests] = useState<BreakRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  useEffect(() => {
    fetchRequests();
  }, [statusFilter, pagination.page]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        status: statusFilter,
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      const response = await fetch(`/api/admin/break-approvals?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch break requests');
      }
      
      const data: ApiResponse = await response.json();
      setRequests(data.requests);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching requests:', error);
      setMessage({ type: 'error', text: 'Failed to load break requests' });
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (requestId: string, action: 'APPROVE' | 'REJECT', rejectionReason?: string) => {
    try {
      setActionLoading(requestId);
      setMessage(null);

      const response = await fetch('/api/admin/break-approvals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId,
          action,
          rejectionReason: action === 'REJECT' ? rejectionReason : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process request');
      }

      const data = await response.json();
      
      setMessage({ 
        type: 'success', 
        text: data.message 
      });

      // Refresh requests
      await fetchRequests();

    } catch (error) {
      console.error('Error processing request:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to process request' 
      });
    } finally {
      setActionLoading(null);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    const colors = {
      PENDING: 'bg-amber-500/15 text-amber-400',
      APPROVED: 'bg-emerald-500/15 text-emerald-400',
      REJECTED: 'bg-red-500/15 text-red-400',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-500/15 text-gray-400';
  };

  const getReasonColor = (reason: string) => {
    const colors = {
      LUNCH: 'bg-orange-500/15 text-orange-400',
      REST: 'bg-blue-500/15 text-blue-400',
      PERSONAL: 'bg-purple-500/15 text-purple-400',
      EMERGENCY: 'bg-red-500/15 text-red-400',
      OTHER: 'bg-gray-500/15 text-gray-400',
    };
    return colors[reason as keyof typeof colors] || 'bg-gray-500/15 text-gray-400';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-primary)] mx-auto mb-4"></div>
          <p className="text-[var(--text-muted)]">Loading break requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Break Approval Requests</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Manage driver break requests that exceed the 30-minute daily limit.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-[var(--text-strong)]">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className="px-3 py-1.5 text-sm border border-[var(--surface-border)] rounded-lg bg-[var(--surface)] text-[var(--text-strong)]"
            >
              <option value="ALL">All Requests</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
          
          <button
            onClick={() => fetchRequests()}
            className="px-4 py-2 text-sm font-medium text-[var(--text-strong)] border border-[var(--surface-border)] rounded-lg hover:bg-[var(--surface)] transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          message.type === 'success' 
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
            : 'border-red-500/30 bg-red-500/10 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Requests List */}
      {requests.length === 0 ? (
        <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-12 text-center">
          <p className="text-[var(--text-muted)]">No break requests found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div key={request.id} className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-4">
                  {/* Header */}
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-[var(--text-strong)]">
                        {request.User.name || 'Unnamed Driver'}
                      </p>
                      <p className="text-sm text-[var(--text-muted)]">{request.User.email}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(request.status)}`}>
                      {request.status}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${getReasonColor(request.reason)}`}>
                      {request.reasonDisplay}
                    </span>
                  </div>

                  {/* Break Details */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-[var(--text-strong)]">Requested Break:</p>
                      <p className="text-[var(--text-muted)]">{request.reasonDisplay}</p>
                      {request.notes && <p className="text-[var(--text-muted)]">Notes: {request.notes}</p>}
                    </div>
                    <div>
                      <p className="font-medium text-[var(--text-strong)]">Today's Break Time:</p>
                      <p className="text-[var(--text-muted)]">
                        {request.todayBreakStats.totalBreakTime} minutes taken
                        <span className="ml-2 text-amber-400">
                          ({request.todayBreakStats.remainingTime} minutes remaining)
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div className="text-xs text-[var(--text-muted)] space-y-1">
                    <p>Requested: {formatDateTime(request.createdAt)}</p>
                    {request.approvedAt && (
                      <p>
                        {request.status === 'APPROVED' ? 'Approved' : 'Rejected'}: {formatDateTime(request.approvedAt)}
                      </p>
                    )}
                    {request.rejectionReason && (
                      <p className="text-red-400">Reason: {request.rejectionReason}</p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {request.status === 'PENDING' && (
                  <div className="flex flex-col gap-2 ml-4">
                    <button
                      onClick={() => handleApproval(request.id, 'APPROVE')}
                      disabled={actionLoading === request.id}
                      className="px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {actionLoading === request.id ? 'Processing...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => {
                        const reason = prompt('Rejection reason (optional):');
                        if (reason !== null) {
                          handleApproval(request.id, 'REJECT', reason);
                        }
                      }}
                      disabled={actionLoading === request.id}
                      className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {actionLoading === request.id ? 'Processing...' : 'Reject'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            disabled={pagination.page === 1}
            className="px-3 py-1 text-sm border border-[var(--surface-border)] rounded-lg hover:bg-[var(--surface)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-[var(--text-muted)]">
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
            disabled={pagination.page === pagination.pages}
            className="px-3 py-1 text-sm border border-[var(--surface-border)] rounded-lg hover:bg-[var(--surface)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
