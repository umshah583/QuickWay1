"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  DollarSign,
  Bell,
  Menu,
  X
} from "lucide-react";
import { useState } from "react";

const mobileNavItems = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Bookings", href: "/admin/bookings", icon: Calendar },
  { name: "Customers", href: "/admin/customers", icon: Users },
  { name: "Finance", href: "/admin/finance", icon: DollarSign },
  { name: "More", href: "#", icon: Menu },
];

export function MobileNav() {
  const pathname = usePathname();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  return (
    <>
      {/* Bottom Navigation - Mobile Only */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t border-[var(--surface-border)] shadow-lg">
        <div className="grid grid-cols-5 h-16">
          {mobileNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            const Icon = item.icon;
            
            if (item.name === "More") {
              return (
                <button
                  key={item.name}
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className="flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors active:bg-[var(--hover-bg)]"
                >
                  <Icon className="h-5 w-5 text-[var(--text-muted)]" />
                  <span className="text-[var(--text-muted)]">{item.name}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors active:bg-[var(--hover-bg)] ${
                  isActive
                    ? "text-[var(--brand-primary)]"
                    : "text-[var(--text-muted)]"
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? "text-[var(--brand-primary)]" : ""}`} />
                <span>{item.name}</span>
                {isActive && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-aqua)]"></div>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* More Menu Overlay */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowMoreMenu(false)}
          />
          <div className="absolute bottom-16 left-0 right-0 bg-white border-t border-[var(--surface-border)] shadow-2xl rounded-t-3xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[var(--text-strong)]">More Options</h3>
                <button
                  onClick={() => setShowMoreMenu(false)}
                  className="p-2 rounded-xl hover:bg-[var(--hover-bg)] transition-colors"
                >
                  <X className="h-5 w-5 text-[var(--text-muted)]" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Link
                  href="/admin/analytics"
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--hover-bg)] transition-all active:scale-95"
                  onClick={() => setShowMoreMenu(false)}
                >
                  <LayoutDashboard className="h-6 w-6 text-[var(--brand-primary)]" />
                  <span className="text-xs font-semibold text-[var(--text-strong)]">Analytics</span>
                </Link>
                <Link
                  href="/admin/promotions"
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--hover-bg)] transition-all active:scale-95"
                  onClick={() => setShowMoreMenu(false)}
                >
                  <DollarSign className="h-6 w-6 text-[var(--brand-primary)]" />
                  <span className="text-xs font-semibold text-[var(--text-strong)]">Promos</span>
                </Link>
                <Link
                  href="/admin/notifications"
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--hover-bg)] transition-all active:scale-95"
                  onClick={() => setShowMoreMenu(false)}
                >
                  <Bell className="h-6 w-6 text-[var(--brand-primary)]" />
                  <span className="text-xs font-semibold text-[var(--text-strong)]">Alerts</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
