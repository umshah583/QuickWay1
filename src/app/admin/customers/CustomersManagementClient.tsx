"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { 
  Search, 
  User, 
  Phone, 
  Mail, 
  DollarSign, 
  Calendar,
  X,
  TrendingUp,
  Package,
  CheckCircle,
  Clock,
  MapPin
} from "lucide-react";

type Booking = {
  id: string;
  createdAt: Date;
  status: string;
  taskStatus: string | null;
  locationLabel: string | null;
  Service: { name: string; priceCents: number } | null;
  Payment: { status: string; amountCents: number } | null;
};

type SubscriptionRequest = {
  id: string;
  createdAt: Date;
  status: string;
  MonthlyPackage: { name: string; priceCents: number } | null;
};

type Customer = {
  id: string;
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
  image: string | null;
  createdAt: Date;
  emailVerified: Date | null;
  totalBookings: number;
  lifetimeValue: number;
  activeSubscriptions: number;
  currentLoyaltyPoints: number;
  bookings?: Booking[];
  subscriptionRequests?: SubscriptionRequest[];
};

interface CustomersManagementClientProps {
  customers: Customer[];
}

export function CustomersManagementClient({ customers }: CustomersManagementClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Filter customers
  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;

    const query = searchQuery.toLowerCase();
    return customers.filter(customer => 
      customer.name?.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query) ||
      customer.phoneNumber?.toLowerCase().includes(query)
    );
  }, [customers, searchQuery]);

  const formatCurrency = (cents: number) => {
    return `AED ${(cents / 100).toFixed(2)}`;
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-700 border border-amber-300">
            <Clock className="h-3 w-3" />
            Pending
          </span>
        );
      case "CONFIRMED":
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-700 border border-emerald-300">
            <CheckCircle className="h-3 w-3" />
            {status === "CONFIRMED" ? "Confirmed" : "Completed"}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gradient bg-gradient-to-r from-[var(--brand-navy)] to-[var(--brand-primary)] bg-clip-text text-transparent">
            Customer Management
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Manage customer profiles and track their activity
          </p>
        </div>
        <div className="text-sm text-[var(--text-muted)]">
          <span className="font-semibold text-[var(--brand-primary)]">{filteredCustomers.length}</span> customers
        </div>
      </div>

      {/* Search */}
      <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-6 shadow-lg">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search by name, email, or phone number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/60 backdrop-blur-sm border-2 border-[var(--surface-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-all"
          />
        </div>
      </div>

      {/* Customers Table */}
      <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--surface-secondary)] backdrop-blur-sm">
                <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                  Total Bookings
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                  Lifetime Value
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                  Subscriptions
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                  Member Since
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {filteredCustomers.map((customer) => (
                <tr
                  key={customer.id}
                  className="bg-[var(--surface)] backdrop-blur-sm hover:bg-[var(--hover-bg)] transition-all cursor-pointer"
                  onClick={() => setSelectedCustomer(customer)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      {customer.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={customer.image}
                          alt={customer.name || "Customer"}
                          className="h-10 w-10 rounded-full object-cover border-2 border-[var(--brand-primary)]"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-aqua)] text-sm font-bold text-white shadow-md">
                          {getInitials(customer.name)}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-semibold text-[var(--text-strong)]">
                          {customer.name || "Guest User"}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                          ID: {customer.id.slice(0, 8)}...
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-[var(--text-medium)]">
                        <Mail className="h-3 w-3 text-[var(--text-muted)]" />
                        {customer.email || "N/A"}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[var(--text-medium)]">
                        <Phone className="h-3 w-3 text-[var(--text-muted)]" />
                        {customer.phoneNumber || "N/A"}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-[var(--brand-primary)]" />
                      <span className="text-sm font-semibold text-[var(--text-strong)]">
                        {customer.totalBookings}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-[var(--brand-primary)]" />
                      <span className="text-sm font-semibold text-[var(--text-strong)]">
                        {formatCurrency(customer.lifetimeValue)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-[var(--brand-primary)]" />
                      <span className="text-sm font-semibold text-[var(--text-strong)]">
                        {customer.activeSubscriptions}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {customer.emailVerified ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-700 border border-emerald-300">
                        <CheckCircle className="h-3 w-3" />
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-700 border border-amber-300">
                        <Clock className="h-3 w-3" />
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-medium)]">
                    {format(new Date(customer.createdAt), "MMM dd, yyyy")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCustomer(customer);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[var(--brand-primary)]/10 to-[var(--brand-aqua)]/5 border border-[var(--brand-primary)]/20 text-[var(--brand-primary)] text-xs font-semibold hover:from-[var(--brand-primary)]/20 hover:to-[var(--brand-aqua)]/10 transition-all hover:scale-105"
                    >
                      <User className="h-3 w-3" />
                      View Profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCustomers.length === 0 && (
          <div className="px-6 py-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-[var(--brand-primary)]/10 to-[var(--brand-aqua)]/5 mb-4">
              <User className="h-8 w-8 text-[var(--text-muted)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-strong)] mb-2">No customers found</h3>
            <p className="text-sm text-[var(--text-muted)]">
              {searchQuery
                ? "Try adjusting your search query"
                : "Customers will appear here once they sign up"}
            </p>
          </div>
        )}
      </div>

      {/* Profile Drawer */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedCustomer(null)}
          />
          
          {/* Drawer */}
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-[var(--background)] shadow-2xl overflow-y-auto">
            <div className="sticky top-0 z-10 glass-card border-b border-[var(--surface-border)] bg-[var(--card-bg)] backdrop-blur-xl px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gradient bg-gradient-to-r from-[var(--brand-navy)] to-[var(--brand-primary)] bg-clip-text text-transparent">
                  Customer Profile
                </h2>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="p-2 rounded-xl hover:bg-[var(--hover-bg)] transition-colors"
                >
                  <X className="h-5 w-5 text-[var(--text-muted)]" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Customer Info Card */}
              <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-6 shadow-lg">
                <div className="flex items-start gap-4">
                  {selectedCustomer.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedCustomer.image}
                      alt={selectedCustomer.name || "Customer"}
                      className="h-20 w-20 rounded-full object-cover border-4 border-[var(--brand-primary)] shadow-lg"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-aqua)] text-2xl font-bold text-white shadow-lg">
                      {getInitials(selectedCustomer.name)}
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-[var(--text-strong)]">
                      {selectedCustomer.name || "Guest User"}
                    </h3>
                    <p className="text-sm text-[var(--text-muted)] mt-1">
                      Customer ID: {selectedCustomer.id}
                    </p>
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2 text-sm text-[var(--text-medium)]">
                        <Mail className="h-4 w-4 text-[var(--brand-primary)]" />
                        {selectedCustomer.email || "N/A"}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[var(--text-medium)]">
                        <Phone className="h-4 w-4 text-[var(--brand-primary)]" />
                        {selectedCustomer.phoneNumber || "N/A"}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[var(--text-medium)]">
                        <Calendar className="h-4 w-4 text-[var(--brand-primary)]" />
                        Member since {format(new Date(selectedCustomer.createdAt), "MMMM dd, yyyy")}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="glass-card rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-4 shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-[var(--brand-primary)]" />
                    <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">Bookings</span>
                  </div>
                  <div className="text-2xl font-bold text-[var(--text-strong)]">
                    {selectedCustomer.totalBookings}
                  </div>
                </div>
                <div className="glass-card rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-4 shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-[var(--brand-primary)]" />
                    <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">LTV</span>
                  </div>
                  <div className="text-2xl font-bold text-[var(--text-strong)]">
                    {formatCurrency(selectedCustomer.lifetimeValue)}
                  </div>
                </div>
                <div className="glass-card rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-4 shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-4 w-4 text-[var(--brand-primary)]" />
                    <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">Plans</span>
                  </div>
                  <div className="text-2xl font-bold text-[var(--text-strong)]">
                    {selectedCustomer.activeSubscriptions}
                  </div>
                </div>
                <div className="glass-card rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-4 shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-[var(--brand-primary)]" />
                    <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">Points</span>
                  </div>
                  <div className="text-2xl font-bold text-[var(--text-strong)]">
                    {selectedCustomer.currentLoyaltyPoints || 0}
                  </div>
                </div>
              </div>

              {/* Booking History */}
              <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-6 shadow-lg">
                <h3 className="text-lg font-bold text-[var(--text-strong)] mb-4">
                  Booking History
                </h3>
                {selectedCustomer.bookings && selectedCustomer.bookings.length > 0 ? (
                  <div className="space-y-3">
                    {selectedCustomer.bookings.slice(0, 10).map((booking) => (
                      <div
                        key={booking.id}
                        className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--hover-bg)] transition-all"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-[var(--text-strong)]">
                              {booking.Service?.name || "Service"}
                            </span>
                            {getStatusBadge(booking.status)}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(booking.createdAt), "MMM dd, yyyy")}
                            </div>
                            {booking.locationLabel && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {booking.locationLabel}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-[var(--brand-primary)]">
                          {booking.Payment?.status === "PAID" 
                            ? formatCurrency(booking.Payment.amountCents)
                            : booking.Service 
                            ? formatCurrency(booking.Service.priceCents)
                            : "N/A"}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-3" />
                    <p className="text-sm text-[var(--text-muted)]">No bookings yet</p>
                  </div>
                )}
              </div>

              {/* Subscription Info */}
              <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-6 shadow-lg">
                <h3 className="text-lg font-bold text-[var(--text-strong)] mb-4">
                  Subscription Plans
                </h3>
                {selectedCustomer.subscriptionRequests && selectedCustomer.subscriptionRequests.length > 0 ? (
                  <div className="space-y-3">
                    {selectedCustomer.subscriptionRequests.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--hover-bg)] transition-all"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Package className="h-4 w-4 text-[var(--brand-primary)]" />
                            <span className="text-sm font-semibold text-[var(--text-strong)]">
                              {sub.MonthlyPackage?.name || "Package"}
                            </span>
                          </div>
                          <div className="text-xs text-[var(--text-muted)]">
                            Started {format(new Date(sub.createdAt), "MMM dd, yyyy")}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-[var(--brand-primary)]">
                          {sub.MonthlyPackage ? formatCurrency(sub.MonthlyPackage.priceCents) : "N/A"}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-3" />
                    <p className="text-sm text-[var(--text-muted)]">No active subscriptions</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
