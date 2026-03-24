"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { 
  Calendar as CalendarIcon, 
  Filter, 
  Search, 
  Eye, 
  LayoutGrid,
  LayoutList,
  MapPin,
  DollarSign,
  CheckCircle,
  AlertCircle,
  XCircle,
  Edit,
  Trash2
} from "lucide-react";
import Link from "next/link";

type Booking = {
  id: string;
  createdAt: Date;
  startAt: Date | null;
  status: string;
  taskStatus: string | null;
  locationLabel: string | null;
  locationCoordinates: string | null;
  cashCollected: boolean;
  cashSettled: boolean;
  cashAmountCents: number | null;
  invoiceNumber: string | null;
  orderNumber: string | null;
  // Pricing fields
  servicePriceCents: number | null;
  serviceDiscountPercentage: number | null;
  couponDiscountCents: number;
  loyaltyCreditAppliedCents: number;
  taxPercentage: number | null;
  stripeFeePercentage: number | null;
  extraFeeCents: number | null;
  // Calculated price fields
  calculatedFinalPriceCents: number;
  calculatedFinalPrice: string;
  basePriceCents: number;
  basePrice: string;
  totalDiscountCents: number;
  hasDiscount: boolean;
  user: { id: string; name: string | null; email: string | null; phoneNumber: string | null } | null;
  service: { id: string; name: string; priceCents: number } | null;
  driver: { id: string; name: string | null; email: string | null } | null;
  payment: { id: string; status: string; amountCents: number; provider: string | null } | null;
};

type Driver = {
  id: string;
  name: string | null;
  email: string | null;
};

interface BookingsManagementClientProps {
  bookings: Booking[];
  drivers: Driver[];
}

export function BookingsManagementClient({ bookings, drivers }: BookingsManagementClientProps) {
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [washerFilter, setWasherFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  // Extract unique cities from location labels
  const cities = useMemo(() => {
    const citySet = new Set<string>();
    bookings.forEach(booking => {
      if (booking.locationLabel) {
        // Extract city from location (assuming format like "Dubai Marina, Dubai")
        const parts = booking.locationLabel.split(",");
        if (parts.length > 1) {
          citySet.add(parts[parts.length - 1].trim());
        }
      }
    });
    return Array.from(citySet).sort();
  }, [bookings]);

  // Filter bookings
  const filteredBookings = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return bookings.filter((booking: any) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          booking.id.toLowerCase().includes(query) ||
          booking.user?.name?.toLowerCase().includes(query) ||
          booking.user?.email?.toLowerCase().includes(query) ||
          booking.service?.name.toLowerCase().includes(query) ||
          booking.locationLabel?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter !== "all" && booking.status !== statusFilter) return false;

      // Task status filter
      if (taskStatusFilter !== "all") {
        if (taskStatusFilter === "UNASSIGNED" && booking.taskStatus !== null) return false;
        if (taskStatusFilter !== "UNASSIGNED" && booking.taskStatus !== taskStatusFilter) return false;
      }

      // City filter
      if (cityFilter !== "all") {
        if (!booking.locationLabel?.includes(cityFilter)) return false;
      }

      // Washer (driver) filter
      if (washerFilter !== "all") {
        if (washerFilter === "unassigned" && booking.driver !== null) return false;
        if (washerFilter !== "unassigned" && booking.driver?.id !== washerFilter) return false;
      }

      // Date filter
      if (dateFilter !== "all") {
        const bookingDate = new Date(booking.createdAt);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        switch (dateFilter) {
          case "today":
            const todayEnd = new Date(today);
            todayEnd.setHours(23, 59, 59, 999);
            if (bookingDate < today || bookingDate > todayEnd) return false;
            break;
          case "week":
            const weekAgo = new Date(today);
            weekAgo.setDate(today.getDate() - 7);
            if (bookingDate < weekAgo) return false;
            break;
          case "month":
            const monthAgo = new Date(today);
            monthAgo.setMonth(today.getMonth() - 1);
            if (bookingDate < monthAgo) return false;
            break;
        }
      }

      return true;
    });
  }, [bookings, searchQuery, statusFilter, taskStatusFilter, cityFilter, washerFilter, dateFilter]);

  const handleDeleteBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to delete this booking? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete booking');
      }

      // Refresh the bookings list
      window.location.reload();
    } catch (error) {
      console.error('Error deleting booking:', error);
      alert('Failed to delete booking. Please try again.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-300">
            <AlertCircle className="h-2.5 w-2.5" />
            Pending
          </span>
        );
      case "CONFIRMED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-300">
            <CheckCircle className="h-2.5 w-2.5" />
            Confirmed
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-300">
            <CheckCircle className="h-2.5 w-2.5" />
            Completed
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-300">
            <XCircle className="h-2.5 w-2.5" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300">
            {status}
          </span>
        );
    }
  };

  const formatCurrency = (cents: number) => {
    return `AED ${(cents / 100).toFixed(2)}`;
  };

  const getAmount = (booking: Booking) => {
    if (booking.payment?.status === "PAID") {
      return formatCurrency(booking.payment.amountCents);
    }
    if (booking.cashCollected && booking.cashAmountCents) {
      return formatCurrency(booking.cashAmountCents);
    }
    // Use the calculated final price instead of base service price
    if (booking.calculatedFinalPriceCents !== undefined) {
      return formatCurrency(booking.calculatedFinalPriceCents);
    }
    if (booking.service) {
      return formatCurrency(booking.service.priceCents);
    }
    return "N/A";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gradient bg-gradient-to-r from-[var(--brand-navy)] to-[var(--brand-primary)] bg-clip-text text-transparent">
            Bookings Management
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Manage and track all car wash bookings
          </p>
        </div>
        
        {/* View Toggle */}
        <div className="flex items-center gap-2 glass-card px-2 py-2 rounded-xl border border-[var(--surface-border)]">
          <button
            onClick={() => setViewMode("table")}
            className={`p-2 rounded-lg transition-all ${
              viewMode === "table"
                ? "bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-aqua)] text-white shadow-md"
                : "text-[var(--text-muted)] hover:bg-[var(--hover-bg)]"
            }`}
          >
            <LayoutList className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            className={`p-2 rounded-lg transition-all ${
              viewMode === "calendar"
                ? "bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-aqua)] text-white shadow-md"
                : "text-[var(--text-muted)] hover:bg-[var(--hover-bg)]"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-6 shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-[var(--brand-primary)]" />
          <h2 className="text-lg font-semibold text-[var(--text-strong)]">Filters</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-[var(--text-label)] mb-2">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search by ID, customer, service..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white/60 backdrop-blur-sm border-2 border-[var(--surface-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-all"
              />
            </div>
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-label)] mb-2">
              Date Range
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/60 backdrop-blur-sm border-2 border-[var(--surface-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-all"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-label)] mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/60 backdrop-blur-sm border-2 border-[var(--surface-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-all"
            >
              <option value="all">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* City Filter */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-label)] mb-2">
              City
            </label>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/60 backdrop-blur-sm border-2 border-[var(--surface-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-all"
            >
              <option value="all">All Cities</option>
              {cities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          {/* Washer Filter */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-label)] mb-2">
              Washer
            </label>
            <select
              value={washerFilter}
              onChange={(e) => setWasherFilter(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/60 backdrop-blur-sm border-2 border-[var(--surface-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-all"
            >
              <option value="all">All Washers</option>
              <option value="unassigned">Unassigned</option>
              {drivers.map(driver => (
                <option key={driver.id} value={driver.id}>
                  {driver.name || driver.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filters Summary */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-[var(--text-muted)]">
            {filteredBookings.length} of {bookings.length} bookings
          </span>
          {(searchQuery || statusFilter !== "all" || taskStatusFilter !== "all" || cityFilter !== "all" || washerFilter !== "all" || dateFilter !== "all") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setTaskStatusFilter("all");
                setCityFilter("all");
                setWasherFilter("all");
                setDateFilter("all");
              }}
              className="text-xs font-semibold text-[var(--brand-primary)] hover:text-[var(--brand-aqua)] transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* Table View */}
      {viewMode === "table" && (
        <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead>
                <tr className="bg-[var(--surface-secondary)] backdrop-blur-sm">
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-[var(--text-medium)] uppercase tracking-wider w-[70px]">
                    Order ID
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-[var(--text-medium)] uppercase tracking-wider w-[70px]">
                    Invoice
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-[var(--text-medium)] uppercase tracking-wider w-[70px]">
                    Booked
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-[var(--text-medium)] uppercase tracking-wider w-[55px]">
                    Time
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-[var(--text-medium)] uppercase tracking-wider w-[70px]">
                    Service Date
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-[var(--text-medium)] uppercase tracking-wider w-[55px]">
                    Time
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-[var(--text-medium)] uppercase tracking-wider w-[90px]">
                    Customer
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-[var(--text-medium)] uppercase tracking-wider w-[100px]">
                    Email
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-[var(--text-medium)] uppercase tracking-wider w-[80px]">
                    Service
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-[var(--text-medium)] uppercase tracking-wider w-[100px]">
                    Location
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-[var(--text-medium)] uppercase tracking-wider w-[70px]">
                    Status
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-[var(--text-medium)] uppercase tracking-wider w-[80px]">
                    Washer
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-[var(--text-medium)] uppercase tracking-wider w-[60px]">
                    Amount
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-[var(--text-medium)] uppercase tracking-wider w-[110px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {filteredBookings.map((booking) => (
                  <tr
                    key={booking.id}
                    className="bg-[var(--surface)] backdrop-blur-sm hover:bg-[var(--hover-bg)] transition-all"
                  >
                    <td className="px-2 py-1.5 whitespace-nowrap text-[10px] font-mono text-[var(--text-medium)]">
                      {booking.orderNumber || <span className="text-[10px] italic text-[var(--text-muted)]">—</span>}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-[10px] font-mono text-[var(--text-medium)]">
                      {booking.invoiceNumber || <span className="text-[10px] italic text-[var(--text-muted)]">—</span>}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-[10px] text-[var(--text-medium)]">
                      {format(new Date(booking.createdAt), "MMM dd, yy")}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-[10px] text-[var(--text-medium)]">
                      {format(new Date(booking.createdAt), "hh:mm a")}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-[10px] text-[var(--text-medium)]">
                      {booking.startAt ? (
                        format(new Date(booking.startAt), "MMM dd, yy")
                      ) : (
                        <span className="text-[10px] italic text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-[10px] text-[var(--text-medium)]">
                      {booking.startAt ? (
                        format(new Date(booking.startAt), "hh:mm a")
                      ) : (
                        <span className="text-[10px] italic text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <div className="text-[10px] font-medium text-[var(--text-strong)] truncate">
                        {booking.user?.name || "Guest"}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <div className="text-[10px] text-[var(--text-medium)] truncate" title={booking.user?.email || "N/A"}>
                        {booking.user?.email || "N/A"}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <div className="text-[10px] font-medium text-[var(--text-strong)] truncate">
                        {booking.service?.name || "N/A"}
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-2.5 w-2.5 text-[var(--brand-primary)] flex-shrink-0" />
                        <span className="text-[10px] text-[var(--text-medium)] truncate">
                          {booking.locationLabel || "N/A"}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {getStatusBadge(booking.status)}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {booking.driver ? (
                        <div className="text-[10px] font-medium text-[var(--text-strong)] truncate">
                          {booking.driver.name || booking.driver.email}
                        </div>
                      ) : (
                        <span className="text-[10px] text-[var(--text-muted)] italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <div className="flex items-center gap-0.5">
                        <DollarSign className="h-2.5 w-2.5 text-[var(--brand-primary)]" />
                        <span className="text-[10px] font-semibold text-[var(--text-strong)]">
                          {getAmount(booking)}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <div className="flex items-center gap-0.5">
                        <Link
                          href={`/admin/bookings/${booking.id}`}
                          className="inline-flex items-center gap-1 px-1.5 py-1 rounded bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 transition-colors"
                        >
                          <Eye className="h-2.5 w-2.5" />
                          View
                        </Link>
                        <Link
                          href={`/admin/bookings/${booking.id}/edit`}
                          className="inline-flex items-center gap-1 px-1.5 py-1 rounded bg-amber-50 text-amber-600 text-xs font-medium hover:bg-amber-100 transition-colors"
                        >
                          <Edit className="h-2.5 w-2.5" />
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDeleteBooking(booking.id)}
                          className="inline-flex items-center gap-1 px-1.5 py-1 rounded bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredBookings.length === 0 && (
            <div className="px-6 py-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-[var(--brand-primary)]/10 to-[var(--brand-aqua)]/5 mb-4">
                <CalendarIcon className="h-8 w-8 text-[var(--text-muted)]" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-strong)] mb-2">No bookings found</h3>
              <p className="text-sm text-[var(--text-muted)]">
                {searchQuery || statusFilter !== "all" || cityFilter !== "all" || washerFilter !== "all" || dateFilter !== "all"
                  ? "Try adjusting your filters to see more results"
                  : "Bookings will appear here once customers start placing orders"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-6 shadow-lg">
          <div className="text-center py-12">
            <CalendarIcon className="h-16 w-16 text-[var(--text-muted)] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[var(--text-strong)] mb-2">Calendar View</h3>
            <p className="text-sm text-[var(--text-muted)]">
              Calendar view coming soon. Switch to table view to manage bookings.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
