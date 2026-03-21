"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { 
  Bell, 
  Send, 
  Filter,
  Mail,
  MailOpen,
  AlertCircle,
  Info,
  Calendar,
  DollarSign,
  Package,
  Trash2,
  Check
} from "lucide-react";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: Date;
  userId: string | null;
};

interface NotificationCenterClientProps {
  notifications: Notification[];
  totalNotifications: number;
  unreadCount: number;
  readCount: number;
}

export function NotificationCenterClient({
  notifications,
  totalNotifications,
  unreadCount,
  readCount,
}: NotificationCenterClientProps) {
  const [showBroadcastForm, setShowBroadcastForm] = useState(false);
  const [readFilter, setReadFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter(notification => {
      if (readFilter === "read" && !notification.read) return false;
      if (readFilter === "unread" && notification.read) return false;
      if (typeFilter !== "all" && notification.type !== typeFilter) return false;
      return true;
    });
  }, [notifications, readFilter, typeFilter]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "BOOKING":
        return <Calendar className="h-5 w-5 text-blue-600" />;
      case "PAYMENT":
        return <DollarSign className="h-5 w-5 text-emerald-600" />;
      case "SUBSCRIPTION":
        return <Package className="h-5 w-5 text-purple-600" />;
      case "SYSTEM":
        return <Info className="h-5 w-5 text-cyan-600" />;
      case "ALERT":
        return <AlertCircle className="h-5 w-5 text-amber-600" />;
      default:
        return <Bell className="h-5 w-5 text-[var(--brand-primary)]" />;
    }
  };

  const toggleNotificationSelection = (id: string) => {
    const newSelected = new Set(selectedNotifications);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedNotifications(newSelected);
  };

  const selectAll = () => {
    setSelectedNotifications(new Set(filteredNotifications.map(n => n.id)));
  };

  const deselectAll = () => {
    setSelectedNotifications(new Set());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gradient bg-gradient-to-r from-[var(--brand-navy)] to-[var(--brand-primary)] bg-clip-text text-transparent">
            Notification Center
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Manage system notifications and broadcasts
          </p>
        </div>
        <button
          onClick={() => setShowBroadcastForm(!showBroadcastForm)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-aqua)] text-white font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105"
        >
          <Send className="h-4 w-4" />
          Send Broadcast
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-6 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-r from-[var(--brand-primary)]/20 to-[var(--brand-aqua)]/10">
              <Bell className="h-5 w-5 text-[var(--brand-primary)]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase">Total</p>
              <p className="text-2xl font-bold text-[var(--text-strong)]">{totalNotifications}</p>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-6 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/10">
              <Mail className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase">Unread</p>
              <p className="text-2xl font-bold text-[var(--text-strong)]">{unreadCount}</p>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-6 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-500/20 to-green-500/10">
              <MailOpen className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase">Read</p>
              <p className="text-2xl font-bold text-[var(--text-strong)]">{readCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Broadcast Form */}
      {showBroadcastForm && (
        <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-6 shadow-lg">
          <h3 className="text-lg font-bold text-[var(--text-strong)] mb-6">Send Broadcast Notification</h3>
          <form className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-label)] mb-2">
                Notification Title
              </label>
              <input
                type="text"
                placeholder="Important Update"
                className="w-full px-4 py-2.5 bg-white/60 backdrop-blur-sm border-2 border-[var(--surface-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-label)] mb-2">
                Message
              </label>
              <textarea
                placeholder="Enter your broadcast message here..."
                rows={4}
                className="w-full px-4 py-2.5 bg-white/60 backdrop-blur-sm border-2 border-[var(--surface-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-label)] mb-2">
                  Notification Type
                </label>
                <select className="w-full px-4 py-2.5 bg-white/60 backdrop-blur-sm border-2 border-[var(--surface-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-all">
                  <option value="SYSTEM">System</option>
                  <option value="BOOKING">Booking</option>
                  <option value="PAYMENT">Payment</option>
                  <option value="SUBSCRIPTION">Subscription</option>
                  <option value="ALERT">Alert</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-label)] mb-2">
                  Target Audience
                </label>
                <select className="w-full px-4 py-2.5 bg-white/60 backdrop-blur-sm border-2 border-[var(--surface-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-all">
                  <option value="all">All Users</option>
                  <option value="customers">Customers Only</option>
                  <option value="drivers">Drivers Only</option>
                  <option value="partners">Partners Only</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowBroadcastForm(false)}
                className="px-4 py-2.5 rounded-xl border-2 border-[var(--surface-border)] text-[var(--text-medium)] font-semibold hover:bg-[var(--hover-bg)] transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-aqua)] text-white font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105"
              >
                Send to All
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters & Actions */}
      <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-[var(--brand-primary)]" />
              <span className="text-sm font-semibold text-[var(--text-strong)]">Filters:</span>
            </div>
            <select
              value={readFilter}
              onChange={(e) => setReadFilter(e.target.value)}
              className="px-4 py-2 bg-white/60 backdrop-blur-sm border-2 border-[var(--surface-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-primary)] transition-all"
            >
              <option value="all">All</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 bg-white/60 backdrop-blur-sm border-2 border-[var(--surface-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-primary)] transition-all"
            >
              <option value="all">All Types</option>
              <option value="BOOKING">Booking</option>
              <option value="PAYMENT">Payment</option>
              <option value="SUBSCRIPTION">Subscription</option>
              <option value="SYSTEM">System</option>
              <option value="ALERT">Alert</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            {selectedNotifications.size > 0 && (
              <>
                <span className="text-sm text-[var(--text-muted)]">
                  {selectedNotifications.size} selected
                </span>
                <button className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-semibold hover:bg-emerald-100 transition-all">
                  Mark as Read
                </button>
                <button className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-all">
                  Delete
                </button>
              </>
            )}
            <button
              onClick={selectedNotifications.size > 0 ? deselectAll : selectAll}
              className="px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] text-[var(--text-medium)] text-xs font-semibold hover:bg-[var(--hover-bg)] transition-all"
            >
              {selectedNotifications.size > 0 ? "Deselect All" : "Select All"}
            </button>
          </div>
        </div>
      </div>

      {/* Notifications List (Inbox Style) */}
      <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm shadow-lg overflow-hidden">
        <div className="divide-y divide-[var(--surface-border)]">
          {filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`flex items-start gap-4 p-5 hover:bg-[var(--hover-bg)] transition-all cursor-pointer ${
                !notification.read ? "bg-[var(--brand-primary)]/5" : ""
              }`}
            >
              {/* Checkbox */}
              <div className="flex items-center pt-1">
                <input
                  type="checkbox"
                  checked={selectedNotifications.has(notification.id)}
                  onChange={() => toggleNotificationSelection(notification.id)}
                  className="w-4 h-4 rounded border-2 border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20"
                />
              </div>

              {/* Icon */}
              <div className="flex-shrink-0 pt-1">
                <div className="p-2 rounded-lg bg-[var(--surface-secondary)]">
                  {getNotificationIcon(notification.type)}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-1">
                  <h3 className={`text-sm font-semibold ${
                    !notification.read ? "text-[var(--text-strong)]" : "text-[var(--text-medium)]"
                  }`}>
                    {notification.title}
                  </h3>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!notification.read && (
                      <span className="inline-flex h-2 w-2 rounded-full bg-[var(--brand-primary)]"></span>
                    )}
                    <span className="text-xs text-[var(--text-muted)]">
                      {format(new Date(notification.createdAt), "MMM dd, hh:mm a")}
                    </span>
                  </div>
                </div>
                <p className={`text-sm ${
                  !notification.read ? "text-[var(--text-medium)]" : "text-[var(--text-muted)]"
                } line-clamp-2`}>
                  {notification.message}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-[var(--surface-secondary)] text-[var(--text-muted)]">
                    {notification.type}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {!notification.read ? (
                  <button className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-all">
                    <Check className="h-4 w-4" />
                  </button>
                ) : (
                  <button className="p-2 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-muted)] transition-all">
                    <MailOpen className="h-4 w-4" />
                  </button>
                )}
                <button className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-all">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredNotifications.length === 0 && (
          <div className="text-center py-12">
            <Bell className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-[var(--text-strong)] mb-2">No notifications</h3>
            <p className="text-sm text-[var(--text-muted)]">
              {readFilter !== "all" || typeFilter !== "all"
                ? "Try adjusting your filters"
                : "You're all caught up!"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
