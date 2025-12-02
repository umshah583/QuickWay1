"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";

type User = {
  id: string;
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
  role: string;
  emailVerified: string | null;
  phoneVerified: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    bookings: number;
    packageSubscriptions: number;
    driverBookings?: number;
    driverPackageSubscriptions?: number;
  };
};

type EditUser = {
  name?: string;
  email?: string;
  phoneNumber?: string;
  role?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
};

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<EditUser>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/verify-email`, {
        method: "POST",
      });
      if (res.ok) {
        fetchUsers();
        if (selectedUser?.id === userId) {
          const updated = await fetch(`/api/admin/users/${userId}`).then((r) =>
            r.json()
          );
          if (updated.user) setSelectedUser(updated.user);
        }
      }
    } catch (error) {
      console.error("Error verifying email:", error);
    }
  };

  const handleUnverifyEmail = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/verify-email`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchUsers();
        if (selectedUser?.id === userId) {
          const updated = await fetch(`/api/admin/users/${userId}`).then((r) =>
            r.json()
          );
          if (updated.user) setSelectedUser(updated.user);
        }
      }
    } catch (error) {
      console.error("Error unverifying email:", error);
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        setEditMode(false);
        setEditData({});
        fetchUsers();
        const updated = await fetch(`/api/admin/users/${selectedUser.id}`).then(
          (r) => r.json()
        );
        if (updated.user) setSelectedUser(updated.user);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update user");
      }
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        alert("User deleted successfully");
        fetchUsers();
        if (selectedUser?.id === userId) {
          setSelectedUser(null);
        }
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete user");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to delete user");
    }
  };

  const filteredUsers = users.filter((user) => {
    if (!searchQuery) return true;
    const haystack = [
      user.name,
      user.email,
      user.phoneNumber,
      user.role,
    ].join(" ").toLowerCase();
    return haystack.includes(searchQuery.toLowerCase());
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[var(--text-muted)]">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-strong)]">
          User Management
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Manage all users, roles, and email verification status
        </p>
      </header>

      <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-sm">
        <div className="mb-4">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, phone, or role..."
            className="w-full rounded-lg border border-[var(--surface-border)] bg-white px-4 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
          />
        </div>

        <div className="overflow-hidden rounded-lg border border-[var(--surface-border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
              <tr className="text-xs uppercase tracking-wider">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Email Status</th>
                <th className="px-4 py-3">Activity</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="border-t border-[var(--surface-border)] hover:bg-[var(--surface)]/50"
                >
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <p className="font-semibold text-[var(--text-strong)]">
                        {user.name || "No name"}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {user.email || "No email"}
                      </p>
                      {user.phoneNumber && (
                        <p className="text-xs text-[var(--text-muted)]">
                          {user.phoneNumber}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        user.role === "ADMIN"
                          ? "bg-purple-500/15 text-purple-600"
                          : user.role === "DRIVER"
                          ? "bg-blue-500/15 text-blue-600"
                          : user.role === "PARTNER"
                          ? "bg-orange-500/15 text-orange-600"
                          : "bg-gray-500/15 text-gray-600"
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {user.emailVerified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-600">
                        <span>✓</span> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-600">
                        <span>✗</span> Unverified
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                    <div>
                      {user._count.bookings + (user._count.driverBookings ?? 0)} bookings
                    </div>
                    <div>
                      {user._count.packageSubscriptions + (user._count.driverPackageSubscriptions ?? 0)} subscriptions
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                    {formatDistanceToNow(new Date(user.createdAt), {
                      addSuffix: true,
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setEditMode(false);
                        setEditData({});
                      }}
                      className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="py-8 text-center text-sm text-[var(--text-muted)]">
            No users found matching your search.
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--surface-border)] bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[var(--text-strong)]">
                  {editMode ? "Edit User" : "User Details"}
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                  ID: {selectedUser.id}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setEditMode(false);
                  setEditData({});
                }}
                className="text-2xl text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              >
                ×
              </button>
            </div>

            {editMode ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Name
                  </label>
                  <input
                    type="text"
                    defaultValue={selectedUser.name || ""}
                    onChange={(e) =>
                      setEditData({ ...editData, name: e.target.value })
                    }
                    className="w-full rounded-lg border border-[var(--surface-border)] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Email
                  </label>
                  <input
                    type="email"
                    defaultValue={selectedUser.email || ""}
                    onChange={(e) =>
                      setEditData({ ...editData, email: e.target.value })
                    }
                    className="w-full rounded-lg border border-[var(--surface-border)] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    defaultValue={selectedUser.phoneNumber || ""}
                    onChange={(e) =>
                      setEditData({ ...editData, phoneNumber: e.target.value })
                    }
                    className="w-full rounded-lg border border-[var(--surface-border)] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Role</label>
                  <select
                    defaultValue={selectedUser.role}
                    onChange={(e) =>
                      setEditData({ ...editData, role: e.target.value })
                    }
                    className="w-full rounded-lg border border-[var(--surface-border)] px-3 py-2"
                  >
                    <option value="USER">USER</option>
                    <option value="DRIVER">DRIVER</option>
                    <option value="PARTNER">PARTNER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleUpdateUser}
                    disabled={saving}
                    className="rounded-full bg-[var(--brand-primary)] px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)] disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    onClick={() => {
                      setEditMode(false);
                      setEditData({});
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
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                      Name
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {selectedUser.name || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                      Email
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {selectedUser.email || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                      Phone
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {selectedUser.phoneNumber || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                      Role
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {selectedUser.role}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)]/50 p-4">
                  <h3 className="mb-3 font-semibold">Email Verification</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      {selectedUser.emailVerified ? (
                        <p className="text-sm text-emerald-600">
                          ✓ Email verified on{" "}
                          {new Date(selectedUser.emailVerified).toLocaleDateString()}
                        </p>
                      ) : (
                        <p className="text-sm text-amber-600">
                          ✗ Email not verified
                        </p>
                      )}
                    </div>
                    {selectedUser.emailVerified ? (
                      <button
                        onClick={() => handleUnverifyEmail(selectedUser.id)}
                        className="rounded-full border border-red-200 px-4 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                      >
                        Unverify
                      </button>
                    ) : (
                      <button
                        onClick={() => handleVerifyEmail(selectedUser.id)}
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
                      <span className="font-semibold">
                        {selectedUser._count.bookings + (selectedUser._count.driverBookings ?? 0)}
                      </span>
                    </p>
                    <p>
                      <span className="text-[var(--text-muted)]">
                        Subscriptions:
                      </span>{" "}
                      <span className="font-semibold">
                        {selectedUser._count.packageSubscriptions +
                          (selectedUser._count.driverPackageSubscriptions ?? 0)}
                      </span>
                    </p>
                    <p>
                      <span className="text-[var(--text-muted)]">Joined:</span>{" "}
                      <span className="font-semibold">
                        {new Date(selectedUser.createdAt).toLocaleDateString()}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setEditMode(true)}
                    className="rounded-full bg-[var(--brand-primary)] px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)]"
                  >
                    Edit User
                  </button>
                  <button
                    onClick={() => handleDeleteUser(selectedUser.id)}
                    className="rounded-full border border-red-200 px-6 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    Delete User
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
