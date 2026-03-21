"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  RefreshCw,
  Search,
  Activity,
  Car,
  User,
  CreditCard,
  Settings,
  MapPin,
  Clock,
  Filter,
  X,
} from "lucide-react";
import { format } from "date-fns";

interface SystemEvent {
  id: string;
  eventType: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  actorType?: string;
  actorName?: string;
  latitude?: number;
  longitude?: number;
  metadata?: Record<string, unknown>;
  processed: boolean;
  processedAt?: string;
  createdAt: string;
}

interface Statistics {
  summary: {
    total: number;
    unprocessed: number;
    critical: number;
    errors: number;
    warnings: number;
    info: number;
  };
  byCategory: Record<string, number>;
  topEventTypes: Array<{ type: string; count: number }>;
  recentCritical: SystemEvent[];
  hourlyTrend: Array<{ hour: string; count: number }>;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  BOOKING: <Car className="h-4 w-4" />,
  DRIVER: <User className="h-4 w-4" />,
  CUSTOMER: <User className="h-4 w-4" />,
  PAYMENT: <CreditCard className="h-4 w-4" />,
  SYSTEM: <Settings className="h-4 w-4" />,
  TRACKING: <MapPin className="h-4 w-4" />,
};

const SEVERITY_CONFIG: Record<string, { color: string; textColor: string; bgColor: string }> = {
  CRITICAL: { color: "border-red-300", textColor: "text-red-700", bgColor: "bg-red-100" },
  ERROR: { color: "border-red-200", textColor: "text-red-600", bgColor: "bg-red-50" },
  WARNING: { color: "border-yellow-300", textColor: "text-yellow-700", bgColor: "bg-yellow-50" },
  INFO: { color: "border-blue-200", textColor: "text-blue-600", bgColor: "bg-blue-50" },
};

export default function NotificationCenterPage() {
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [liveUpdates, setLiveUpdates] = useState(true);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: "25" });
      if (search) params.set("search", search);
      if (categoryFilter) params.set("category", categoryFilter);
      if (severityFilter) params.set("severity", severityFilter);

      const res = await fetch(`/api/admin/notification-center?${params}`);
      const data = await res.json();
      if (data.events) {
        setEvents(data.events);
        setTotalPages(data.pagination?.totalPages ?? 1);
      }
    } catch (error) {
      console.error("Failed to fetch events:", error);
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter, severityFilter]);

  const fetchStatistics = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notification-center/statistics");
      const data = await res.json();
      setStatistics(data);
    } catch (error) {
      console.error("Failed to fetch statistics:", error);
    }
  }, []);

  useEffect(() => {
    if (!liveUpdates) {
      eventSourceRef.current?.close();
      return;
    }
    const eventSource = new EventSource("/api/realtime/events?channels=global");
    eventSourceRef.current = eventSource;
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "event" && data.event) {
          setEvents((prev) => [data.event, ...prev.slice(0, 24)]);
          fetchStatistics();
        }
      } catch { /* ignore */ }
    };
    eventSource.onerror = () => {
      setTimeout(() => {
        if (liveUpdates) {
          eventSourceRef.current?.close();
          eventSourceRef.current = new EventSource("/api/realtime/events?channels=global");
        }
      }, 5000);
    };
    return () => eventSource.close();
  }, [liveUpdates, fetchStatistics]);

  useEffect(() => {
    fetchEvents();
    fetchStatistics();
  }, [fetchEvents, fetchStatistics]);

  const markAsProcessed = async () => {
    if (selectedEvents.size === 0) return;
    try {
      await fetch("/api/admin/notification-center", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markProcessed", eventIds: Array.from(selectedEvents) }),
      });
      setSelectedEvents(new Set());
      fetchEvents();
      fetchStatistics();
    } catch (error) {
      console.error("Failed to mark events:", error);
    }
  };

  const toggleEventSelection = (eventId: string) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const selectAllEvents = () => {
    setSelectedEvents(selectedEvents.size === events.length ? new Set() : new Set(events.map((e) => e.id)));
  };

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("");
    setSeverityFilter("");
    setPage(1);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notification Center</h1>
            <p className="text-gray-500">Real-time system events and activity log</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLiveUpdates(!liveUpdates)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
              liveUpdates ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
            }`}
          >
            <Activity className={`h-4 w-4 ${liveUpdates ? "animate-pulse" : ""}`} />
            {liveUpdates ? "Live" : "Paused"}
          </button>
          <button
            onClick={() => { fetchEvents(); fetchStatistics(); }}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Events</p>
              <p className="text-2xl font-bold">{statistics?.summary.total ?? 0}</p>
            </div>
            <Activity className="h-8 w-8 text-gray-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Unprocessed</p>
              <p className="text-2xl font-bold text-orange-600">{statistics?.summary.unprocessed ?? 0}</p>
            </div>
            <Clock className="h-8 w-8 text-orange-400" />
          </div>
        </div>
        <div className="bg-red-50 rounded-lg border border-red-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-700">Critical</p>
              <p className="text-2xl font-bold text-red-700">{statistics?.summary.critical ?? 0}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
        </div>
        <div className="bg-red-50/50 rounded-lg border border-red-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600">Errors</p>
              <p className="text-2xl font-bold text-red-600">{statistics?.summary.errors ?? 0}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
        </div>
        <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-700">Warnings</p>
              <p className="text-2xl font-bold text-yellow-700">{statistics?.summary.warnings ?? 0}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700">Info</p>
              <p className="text-2xl font-bold text-blue-700">{statistics?.summary.info ?? 0}</p>
            </div>
            <Info className="h-8 w-8 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Category Filters */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {Object.entries(statistics?.byCategory ?? {}).map(([category, count]) => (
          <button
            key={category}
            onClick={() => setCategoryFilter(category === categoryFilter ? "" : category)}
            className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition ${
              category === categoryFilter ? "bg-blue-100 border-blue-300" : "bg-white hover:bg-gray-50"
            }`}
          >
            {CATEGORY_ICONS[category] ?? <Activity className="h-4 w-4" />}
            <span>{category}</span>
            <span className="ml-auto bg-gray-100 px-2 py-0.5 rounded text-xs">{count}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Categories</option>
            <option value="BOOKING">Booking</option>
            <option value="DRIVER">Driver</option>
            <option value="CUSTOMER">Customer</option>
            <option value="PAYMENT">Payment</option>
            <option value="SYSTEM">System</option>
            <option value="TRACKING">Tracking</option>
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="ERROR">Error</option>
            <option value="WARNING">Warning</option>
            <option value="INFO">Info</option>
          </select>
          {(search || categoryFilter || severityFilter) && (
            <button onClick={clearFilters} className="flex items-center gap-1 px-3 py-2 text-gray-600 hover:text-gray-800">
              <X className="h-4 w-4" /> Clear
            </button>
          )}
          {selectedEvents.size > 0 && (
            <button
              onClick={markAsProcessed}
              className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200"
            >
              <CheckCircle className="h-4 w-4" />
              Mark {selectedEvents.size} as Processed
            </button>
          )}
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b flex items-center gap-2">
          <Filter className="h-5 w-5 text-gray-500" />
          <h2 className="font-semibold">System Events</h2>
          {loading && <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedEvents.size === events.length && events.length > 0}
                    onChange={selectAllEvents}
                    className="rounded"
                  />
                </th>
                <th className="p-3 text-left text-sm font-medium text-gray-600">Time</th>
                <th className="p-3 text-left text-sm font-medium text-gray-600">Severity</th>
                <th className="p-3 text-left text-sm font-medium text-gray-600">Category</th>
                <th className="p-3 text-left text-sm font-medium text-gray-600">Event</th>
                <th className="p-3 text-left text-sm font-medium text-gray-600">Actor</th>
                <th className="p-3 text-left text-sm font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const config = SEVERITY_CONFIG[event.severity] ?? SEVERITY_CONFIG.INFO;
                return (
                  <tr key={event.id} className={`border-b ${config.bgColor} ${!event.processed ? "" : "opacity-60"}`}>
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedEvents.has(event.id)}
                        onChange={() => toggleEventSelection(event.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="p-3 text-sm">
                      <div>{format(new Date(event.createdAt), "HH:mm:ss")}</div>
                      <div className="text-xs text-gray-500">{format(new Date(event.createdAt), "MMM d")}</div>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium ${config.color} ${config.textColor}`}>
                        {event.severity === "CRITICAL" && <AlertCircle className="h-3 w-3" />}
                        {(event.severity === "ERROR" || event.severity === "WARNING") && <AlertTriangle className="h-3 w-3" />}
                        {event.severity === "INFO" && <Info className="h-3 w-3" />}
                        {event.severity}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 text-sm">
                        {CATEGORY_ICONS[event.category]}
                        <span>{event.category}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-sm">{event.title}</div>
                      <div className="text-xs text-gray-500">{event.description}</div>
                      {event.entityType && event.entityId && (
                        <div className="text-xs text-gray-400 mt-1">{event.entityType}: {event.entityId.slice(0, 8)}...</div>
                      )}
                    </td>
                    <td className="p-3 text-sm">
                      {event.actorName && (
                        <div>
                          <div>{event.actorName}</div>
                          <div className="text-xs text-gray-500">{event.actorType}</div>
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      {event.processed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                          <CheckCircle className="h-3 w-3" /> Done
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                          <Clock className="h-3 w-3" /> New
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {events.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">No events found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-center gap-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Recent Critical Events */}
      {statistics?.recentCritical && statistics.recentCritical.length > 0 && (
        <div className="bg-red-50 rounded-lg border border-red-200 p-4">
          <h3 className="flex items-center gap-2 font-semibold text-red-700 mb-3">
            <AlertCircle className="h-5 w-5" />
            Recent Critical/Error Events
          </h3>
          <div className="space-y-2">
            {statistics.recentCritical.map((event) => (
              <div key={event.id} className="flex items-center gap-3 p-3 bg-white rounded border">
                {event.severity === "CRITICAL" ? <AlertCircle className="h-4 w-4 text-red-600" /> : <AlertTriangle className="h-4 w-4 text-red-500" />}
                <div className="flex-1">
                  <p className="font-medium text-sm">{event.title}</p>
                  <p className="text-xs text-gray-500">{event.description}</p>
                </div>
                <span className="text-xs text-gray-400">{format(new Date(event.createdAt), "HH:mm:ss")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
