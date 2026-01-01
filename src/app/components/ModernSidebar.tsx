"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Car,
  CalendarDays,
  Users,
  Bell,
  Settings,
  ChevronDown,
  Sun,
  Moon,
  LogOut,
  Package,
  DollarSign,
  CheckCircle2,
  Ticket,
  Database,
  Landmark,
  UserCog,
  GitPullRequest,
  Briefcase,
  Wallet,
  MessageCircle,
  Clock,
} from "lucide-react";
import { useState, useEffect, type ComponentType } from "react";
import { signOut } from "next-auth/react";

type NavigationItem = {
  name: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  badge?: boolean;
};

const adminNavigation: NavigationItem[] = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Business Day", href: "/admin/business-day", icon: Clock },
  { name: "Services", href: "/admin/services", icon: Car },
  { name: "Bookings", href: "/admin/bookings", icon: CalendarDays, badge: true },
  { name: "Packages", href: "/admin/packages", icon: Package },
  { name: "Subscriptions", href: "/admin/subscriptions", icon: CalendarDays },
  { name: "Subscription Requests", href: "/admin/subscriptions/requests", icon: GitPullRequest, badge: true },
  { name: "Completed Orders", href: "/admin/bookings/completed", icon: CheckCircle2 },
  { name: "Coupons", href: "/admin/coupons", icon: Ticket },
  { name: "Drivers", href: "/admin/drivers", icon: Users },
  { name: "Customers", href: "/admin/users", icon: Users },
  { name: "User Management", href: "/admin/user-management", icon: UserCog },
  { name: "Notifications", href: "/admin/notifications", icon: Bell, badge: true },
  { name: "Feedback", href: "/admin/feedback", icon: MessageCircle },
  { name: "Collections", href: "/admin/collections", icon: Database },
  { name: "Settlements", href: "/admin/settlements", icon: Landmark },
  { name: "Transactions", href: "/admin/transactions", icon: DollarSign },
  { name: "Partners", href: "/admin/partners", icon: UserCog },
  { name: "Change Requests", href: "/admin/partners/driver-requests", icon: GitPullRequest },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

const partnerNavigation: NavigationItem[] = [
  { name: "Dashboard", href: "/partner", icon: LayoutDashboard },
  { name: "Drivers", href: "/partner/drivers", icon: Users },
  { name: "Assignments", href: "/partner/assignments", icon: Briefcase, badge: true },
  { name: "Services", href: "/partner/services", icon: Car },
  { name: "Earnings", href: "/partner/earnings", icon: Wallet },
  { name: "Settings", href: "/partner/settings", icon: Settings },
];

interface ModernSidebarProps {
  notificationsCount?: number;
  bookingsNewCount?: number;
  subscriptionRequestsCount?: number;
  userRole?: "ADMIN" | "PARTNER";
}

export function ModernSidebar({ 
  notificationsCount = 0, 
  bookingsNewCount = 0, 
  subscriptionRequestsCount = 0, 
  userRole = "ADMIN" 
}: ModernSidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [theme, setTheme] = useState("light");
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "light";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const navigation = userRole === "PARTNER" ? partnerNavigation : adminNavigation;
  const roleLabel = userRole === "PARTNER" ? "Partner" : "Administrator";

  const getBadgeCount = (item: NavigationItem) => {
    if (item.name === "Notifications") return notificationsCount;
    if (item.name === "Bookings" || item.name === "Assignments") return bookingsNewCount;
    if (item.name === "Subscription Requests") return subscriptionRequestsCount;
    return 0;
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] flex flex-col">
      {/* Logo Section */}
      <div className="flex h-16 items-center justify-between border-b border-[var(--sidebar-border)] px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-primary)]">
            <span className="text-sm font-bold text-white">Q</span>
          </div>
          <span className="text-lg font-semibold text-[var(--text-strong)]">QuickWay</span>
        </div>
        <button
          onClick={toggleTheme}
          className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] transition-colors"
        >
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
      </div>

      {/* User Profile Section */}
      <div className="relative border-b border-[var(--sidebar-border)]">
        <button
          onClick={() => setIsProfileOpen(!isProfileOpen)}
          className="flex w-full items-center justify-between px-6 py-4 hover:bg-[var(--hover-bg)] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-gradient)] text-sm font-semibold text-white">
              {session?.user?.name?.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="text-left">
              <div className="text-sm font-medium text-[var(--text-strong)]">
                {session?.user?.name || "Admin User"}
              </div>
              <div className="text-xs text-[var(--text-muted)]">{roleLabel}</div>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-[var(--text-muted)] transition-transform ${isProfileOpen ? "rotate-180" : ""}`} />
        </button>
        
        {isProfileOpen && (
          <div className="absolute top-full left-0 right-0 z-50 border-b border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] shadow-lg">
            <Link href="/admin/profile" className="flex items-center gap-3 px-6 py-3 text-sm text-[var(--text-medium)] hover:bg-[var(--hover-bg)]">
              <Users className="h-4 w-4" />
              <span>View Profile</span>
            </Link>
            <button 
              onClick={() => signOut()}
              className="flex w-full items-center gap-3 px-6 py-3 text-sm text-[var(--text-medium)] hover:bg-[var(--hover-bg)]"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            const badgeCount = getBadgeCount(item);
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-[var(--active-bg)] text-[var(--brand-primary)]"
                    : "text-[var(--text-medium)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-strong)]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </div>
                {item.badge && badgeCount > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--brand-primary)] px-1.5 text-[10px] font-semibold text-white">
                    {badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--sidebar-border)] p-4">
        <div className="rounded-lg bg-[var(--surface-secondary)] px-3 py-2">
          <div className="text-xs font-medium text-[var(--text-label)]">Version</div>
          <div className="text-xs text-[var(--text-muted)]">v2.0.0 Beta</div>
        </div>
      </div>
    </aside>
  );
}
