"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type User = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  emailVerified: string | null;
  tokenVersion: number;
  createdAt: string;
  updatedAt: string;
};

type GroupedUsers = {
  ADMIN: User[];
  DRIVER: User[];
  USER: User[];
  PARTNER: User[];
};

export default function UserForceLogoutClient() {
  const [users, setUsers] = useState<GroupedUsers | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/users/force-logout');
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      const data = await response.json();
      setUsers(data.users);
    } catch (error) {
      console.error('Error fetching users:', error);
      setMessage({ type: 'error', text: 'Failed to load users' });
    } finally {
      setLoading(false);
    }
  };

  const handleForceLogout = async (userId?: string) => {
    try {
      setActionLoading(true);
      setMessage(null);

      const payload = userId ? { userId } : { logoutAll: true };
      
      const response = await fetch('/api/admin/users/force-logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to force logout');
      }

      const data = await response.json();
      
      setMessage({ 
        type: 'success', 
        text: data.message 
      });

      // Refresh users list
      if (!userId) {
        await fetchUsers();
      }

    } catch (error) {
      console.error('Error force logout:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to force logout' 
      });
    } finally {
      setActionLoading(false);
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const getRoleColor = (role: string) => {
    const colors = {
      ADMIN: 'bg-purple-500/15 text-purple-400',
      DRIVER: 'bg-blue-500/15 text-blue-400',
      USER: 'bg-green-500/15 text-green-400',
      PARTNER: 'bg-orange-500/15 text-orange-400'
    };
    return colors[role as keyof typeof colors] || 'bg-gray-500/15 text-gray-400';
  };

  const getSessionStatus = (user: User) => {
    const timeSinceUpdate = Date.now() - new Date(user.updatedAt).getTime();
    const hoursSinceUpdate = timeSinceUpdate / (1000 * 60 * 60);
    
    return {
      status: hoursSinceUpdate < 1 ? 'Active' : 'Idle',
      color: hoursSinceUpdate < 1 ? 'text-green-400' : 'text-gray-400'
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-primary)] mx-auto mb-4"></div>
          <p className="text-[var(--text-muted)]">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Force User Logout</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Forcefully logout users from their active sessions. Use this for security purposes or account management.
            </p>
          </div>
          <button
            onClick={() => fetchUsers()}
            className="px-4 py-2 text-sm font-medium text-[var(--text-strong)] border border-[var(--surface-border)] rounded-lg hover:bg-[var(--surface)] transition"
          >
            Refresh
          </button>
        </div>

        {/* Global Actions */}
        <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-strong)] mb-4">Global Actions</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[var(--text-strong)]">Force Logout All Users</p>
                <p className="text-sm text-[var(--text-muted)]">
                  This will logout all users from their active sessions across the entire platform.
                </p>
              </div>
              <button
                onClick={() => handleForceLogout()}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {actionLoading ? 'Processing...' : 'Logout All Users'}
              </button>
            </div>
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

        {/* Users by Role */}
        {users && Object.entries(users).map(([role, roleUsers]) => (
          <div key={role} className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)]">
            <div className="px-6 py-4 border-b border-[var(--surface-border)]">
              <h3 className="text-lg font-semibold text-[var(--text-strong)] flex items-center gap-2">
                {role}
                <span className={`text-xs px-2 py-1 rounded-full ${getRoleColor(role)}`}>
                  {roleUsers.length} users
                </span>
              </h3>
            </div>
            
            {roleUsers.length === 0 ? (
              <div className="px-6 py-8 text-center text-[var(--text-muted)]">
                No users found in this role
              </div>
            ) : (
              <div className="divide-y divide-[var(--surface-border)]">
                {roleUsers.map((user) => (
                  <div key={user.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium text-[var(--text-strong)]">
                              {user.name || 'Unnamed User'}
                            </p>
                            <p className="text-sm text-[var(--text-muted)]">{user.email}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${getRoleColor(user.role)}`}>
                            {user.role}
                          </span>
                          {user.emailVerified && (
                            <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400">
                              Verified
                            </span>
                          )}
                          <span className={`text-xs px-2 py-1 rounded-full ${getSessionStatus(user).color}`}>
                            {getSessionStatus(user).status}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-[var(--text-muted)] space-y-1">
                          <div>Token Version: <span className="font-mono text-[var(--text-strong)]">v{user.tokenVersion}</span></div>
                          <div>Created: {formatDateTime(user.createdAt)}</div>
                          <div>Last Updated: {formatDateTime(user.updatedAt)}</div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleForceLogout(user.id)}
                        disabled={actionLoading}
                        className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        Force Logout
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
