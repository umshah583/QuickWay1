"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

type Customer = {
  id: string;
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
  emailVerified: string | null;
  phoneVerified: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    bookings: number;
    packageSubscriptions: number;
  };
};

type EditCustomer = {
  name?: string;
  email?: string;
  phoneNumber?: string;
  password?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
};

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<EditCustomer>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await fetch("/api/admin/customers");
      const data = await res.json();
      if (data.customers) {
        setCustomers(data.customers);
      }
    } catch (error) {
      console.error("Error fetching customers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomer = async () => {
    if (!formData.email && !formData.phoneNumber) {
      alert("Email or phone number is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        alert("Customer created successfully");
        setShowCreateModal(false);
        setFormData({});
        fetchCustomers();
      } else {
        alert(data.error || "Failed to create customer");
      }
    } catch (error) {
      console.error("Error creating customer:", error);
      alert("Failed to create customer");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCustomer = async () => {
    if (!selectedCustomer) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/customers/${selectedCustomer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        alert("Customer updated successfully");
        setEditMode(false);
        setFormData({});
        fetchCustomers();
        const updated = await fetch(`/api/admin/customers/${selectedCustomer.id}`).then((r) => r.json());
        if (updated.customer) setSelectedCustomer(updated.customer);
      } else {
        alert(data.error || "Failed to update customer");
      }
    } catch (error) {
      console.error("Error updating customer:", error);
      alert("Failed to update customer");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    if (!confirm("Are you sure you want to delete this customer? This action cannot be undone.")) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        alert("Customer deleted successfully");
        fetchCustomers();
        if (selectedCustomer?.id === customerId) {
          setSelectedCustomer(null);
        }
      } else {
        alert(data.error || "Failed to delete customer");
      }
    } catch (error) {
      console.error("Error deleting customer:", error);
      alert("Failed to delete customer");
    }
  };

  const handleVerifyEmail = async (customerId: string, verify: boolean) => {
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailVerified: verify }),
      });
      if (res.ok) {
        fetchCustomers();
        if (selectedCustomer?.id === customerId) {
          const updated = await fetch(`/api/admin/customers/${customerId}`).then((r) => r.json());
          if (updated.customer) setSelectedCustomer(updated.customer);
        }
      }
    } catch (error) {
      console.error("Error updating verification:", error);
    }
  };

  const filteredCustomers = customers.filter((customer) => {
    if (!searchQuery) return true;
    const haystack = [customer.name, customer.email, customer.phoneNumber].join(" ").toLowerCase();
    return haystack.includes(searchQuery.toLowerCase());
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[var(--text-muted)]">Loading customers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-strong)]">Customers</h1>
          <p className="text-sm text-[var(--text-muted)]">Manage customer accounts for the mobile application</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-1 text-xs text-[var(--text-muted)]">
            Total <strong className="ml-1 text-[var(--text-strong)]">{customers.length}</strong>
          </span>
          <button
            onClick={() => {
              setShowCreateModal(true);
              setFormData({});
            }}
            className="rounded-full bg-[var(--brand-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)]"
          >
            Add Customer
          </button>
        </div>
      </header>

      <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-sm">
        <div className="mb-4">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or phone..."
            className="w-full rounded-lg border border-[var(--surface-border)] bg-white px-4 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
          />
        </div>

        <div className="overflow-hidden rounded-lg border border-[var(--surface-border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
              <tr className="text-xs uppercase tracking-wider">
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email Status</th>
                <th className="px-4 py-3">Bookings</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="border-t border-[var(--surface-border)] hover:bg-[var(--surface)]/50">
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <p className="font-semibold text-[var(--text-strong)]">{customer.name || "No name"}</p>
                      <p className="text-xs text-[var(--text-muted)]">{customer.email || "No email"}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{customer.phoneNumber || "—"}</td>
                  <td className="px-4 py-3">
                    {customer.emailVerified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-600">
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-600">
                        Unverified
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{customer._count.bookings}</td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                    {formatDistanceToNow(new Date(customer.createdAt), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setEditMode(false);
                          setFormData({});
                        }}
                        className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                      >
                        Manage
                      </button>
                      <Link
                        href={`/admin/customers/${customer.id}`}
                        className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                      >
                        Profile
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCustomers.length === 0 && (
          <div className="py-8 text-center text-sm text-[var(--text-muted)]">
            No customers found matching your search.
          </div>
        )}
      </div>

      {/* Create Customer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--surface-border)] bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[var(--text-strong)]">Add New Customer</h2>
                <p className="text-sm text-[var(--text-muted)]">Create a new customer account</p>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({});
                }}
                className="text-2xl text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Name</label>
                <input
                  type="text"
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-[var(--surface-border)] px-3 py-2"
                  placeholder="Customer name"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-lg border border-[var(--surface-border)] px-3 py-2"
                  placeholder="customer@example.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Phone Number</label>
                <input
                  type="tel"
                  value={formData.phoneNumber || ""}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  className="w-full rounded-lg border border-[var(--surface-border)] px-3 py-2"
                  placeholder="+971 50 123 4567"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Password (optional)</label>
                <input
                  type="password"
                  value={formData.password || ""}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full rounded-lg border border-[var(--surface-border)] px-3 py-2"
                  placeholder="Leave empty for no password"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreateCustomer}
                  disabled={saving}
                  className="rounded-full bg-[var(--brand-primary)] px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)] disabled:opacity-50"
                >
                  {saving ? "Creating..." : "Create Customer"}
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({});
                  }}
                  className="rounded-full border border-[var(--surface-border)] px-6 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Detail/Edit Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--surface-border)] bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[var(--text-strong)]">
                  {editMode ? "Edit Customer" : "Customer Details"}
                </h2>
                <p className="text-sm text-[var(--text-muted)]">ID: {selectedCustomer.id}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedCustomer(null);
                  setEditMode(false);
                  setFormData({});
                }}
                className="text-2xl text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              >
                ×
              </button>
            </div>

            {editMode ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Name</label>
                  <input
                    type="text"
                    defaultValue={selectedCustomer.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-lg border border-[var(--surface-border)] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Email</label>
                  <input
                    type="email"
                    defaultValue={selectedCustomer.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-lg border border-[var(--surface-border)] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Phone Number</label>
                  <input
                    type="tel"
                    defaultValue={selectedCustomer.phoneNumber || ""}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    className="w-full rounded-lg border border-[var(--surface-border)] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">New Password (leave empty to keep current)</label>
                  <input
                    type="password"
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full rounded-lg border border-[var(--surface-border)] px-3 py-2"
                    placeholder="Enter new password"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleUpdateCustomer}
                    disabled={saving}
                    className="rounded-full bg-[var(--brand-primary)] px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)] disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    onClick={() => {
                      setEditMode(false);
                      setFormData({});
                    }}
                    className="rounded-full border border-[var(--surface-border)] px-6 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Name</p>
                    <p className="mt-1 text-sm font-semibold">{selectedCustomer.name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Email</p>
                    <p className="mt-1 text-sm font-semibold">{selectedCustomer.email || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Phone</p>
                    <p className="mt-1 text-sm font-semibold">{selectedCustomer.phoneNumber || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Joined</p>
                    <p className="mt-1 text-sm font-semibold">
                      {new Date(selectedCustomer.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)]/50 p-4">
                  <h3 className="mb-3 font-semibold">Email Verification</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      {selectedCustomer.emailVerified ? (
                        <p className="text-sm text-emerald-600">
                          Email verified on {new Date(selectedCustomer.emailVerified).toLocaleDateString()}
                        </p>
                      ) : (
                        <p className="text-sm text-amber-600">Email not verified</p>
                      )}
                    </div>
                    {selectedCustomer.emailVerified ? (
                      <button
                        onClick={() => handleVerifyEmail(selectedCustomer.id, false)}
                        className="rounded-full border border-red-200 px-4 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                      >
                        Unverify
                      </button>
                    ) : (
                      <button
                        onClick={() => handleVerifyEmail(selectedCustomer.id, true)}
                        className="rounded-full bg-emerald-500 px-4 py-1 text-xs font-semibold text-white transition hover:bg-emerald-600"
                      >
                        Verify Now
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)]/50 p-4">
                  <h3 className="mb-3 font-semibold">Activity</h3>
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="text-[var(--text-muted)]">Bookings:</span>{" "}
                      <span className="font-semibold">{selectedCustomer._count.bookings}</span>
                    </p>
                    <p>
                      <span className="text-[var(--text-muted)]">Subscriptions:</span>{" "}
                      <span className="font-semibold">{selectedCustomer._count.packageSubscriptions}</span>
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setEditMode(true)}
                    className="rounded-full bg-[var(--brand-primary)] px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)]"
                  >
                    Edit Customer
                  </button>
                  <Link
                    href={`/admin/customers/${selectedCustomer.id}`}
                    className="rounded-full border border-[var(--surface-border)] px-6 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                  >
                    View Full Profile
                  </Link>
                  <button
                    onClick={() => handleDeleteCustomer(selectedCustomer.id)}
                    className="rounded-full border border-red-200 px-6 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
