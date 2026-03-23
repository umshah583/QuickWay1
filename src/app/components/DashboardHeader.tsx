"use client";

import { useState } from "react";
import { Search, Bell, User, Settings, ChevronDown } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface DashboardHeaderProps {
  title?: string;
  subtitle?: string;
  notificationsCount?: number;
}

export function DashboardHeader({ 
  title = "Dashboard", 
  subtitle = "Welcome back! Here's what's happening with your business today.",
  notificationsCount = 0 
}: DashboardHeaderProps) {
  const { data: session } = useSession();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <header className="sticky top-0 z-40 mb-6">
      {/* Glassmorphism header */}
      <div className="glass-card border-b border-[var(--surface-border)] bg-[var(--glass-bg)] backdrop-blur-xl px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Title Section */}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gradient bg-gradient-to-r from-[var(--brand-navy)] to-[var(--brand-primary)] bg-clip-text text-transparent">
              {title}
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">{subtitle}</p>
          </div>

          {/* Search Bar */}
          <div className="hidden md:flex flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search bookings, customers, services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[var(--glass-bg)] backdrop-blur-sm border-2 border-[var(--surface-border)] rounded-2xl text-sm text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-all"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <button className="relative p-2.5 rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--surface-border)] hover:bg-[var(--hover-bg)] hover:border-[var(--brand-primary)] transition-all hover:scale-105">
              <Bell className="h-5 w-5 text-[var(--text-medium)]" />
              {notificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-aqua)] text-[10px] font-bold text-white shadow-[var(--shadow-glow)]">
                  {notificationsCount > 9 ? '9+' : notificationsCount}
                </span>
              )}
            </button>

            {/* Settings */}
            <Link 
              href="/admin/settings"
              className="p-2.5 rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--surface-border)] hover:bg-[var(--hover-bg)] hover:border-[var(--brand-primary)] transition-all hover:scale-105"
            >
              <Settings className="h-5 w-5 text-[var(--text-medium)]" />
            </Link>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-3 p-2 pr-3 rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--surface-border)] hover:bg-[var(--hover-bg)] hover:border-[var(--brand-primary)] transition-all"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-aqua)] text-sm font-bold text-white shadow-md">
                  {session?.user?.name?.charAt(0).toUpperCase() || "A"}
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-sm font-semibold text-[var(--text-strong)]">
                    {session?.user?.name || "Admin"}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {session?.user?.role || "Administrator"}
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 text-[var(--text-muted)] transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-56 glass-card border border-[var(--surface-border)] rounded-2xl shadow-xl overflow-hidden">
                  <div className="p-4 border-b border-[var(--surface-border)] bg-gradient-to-r from-[var(--brand-primary)]/10 to-[var(--brand-aqua)]/5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-aqua)] text-sm font-bold text-white">
                        {session?.user?.name?.charAt(0).toUpperCase() || "A"}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[var(--text-strong)]">
                          {session?.user?.name || "Admin User"}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {session?.user?.email}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-2">
                    <Link
                      href="/admin/profile"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--text-medium)] hover:bg-[var(--hover-bg)] hover:text-[var(--brand-primary)] transition-all"
                      onClick={() => setIsProfileOpen(false)}
                    >
                      <User className="h-4 w-4" />
                      <span>View Profile</span>
                    </Link>
                    <Link
                      href="/admin/settings"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--text-medium)] hover:bg-[var(--hover-bg)] hover:text-[var(--brand-primary)] transition-all"
                      onClick={() => setIsProfileOpen(false)}
                    >
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
