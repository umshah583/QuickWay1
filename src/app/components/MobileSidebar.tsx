"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { 
  Menu, 
  X, 
  LayoutDashboard,
  Calendar,
  Users,
  DollarSign,
  Bell,
  BarChart3,
  Gift,
  Settings,
  LogOut
} from "lucide-react";
import { signOut } from "next-auth/react";

const sidebarItems = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Bookings", href: "/admin/bookings", icon: Calendar },
  { name: "Customers", href: "/admin/customers", icon: Users },
  { name: "Finance", href: "/admin/finance", icon: DollarSign },
  { name: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { name: "Promotions", href: "/admin/promotions", icon: Gift },
  { name: "Notifications", href: "/admin/notifications", icon: Bell },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

export function MobileSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Hamburger Menu Button - Mobile/Tablet Only */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 left-4 z-40 p-3 rounded-xl bg-white border border-[var(--surface-border)] shadow-lg lg:hidden active:scale-95 transition-all"
      >
        <Menu className="h-5 w-5 text-[var(--text-strong)]" />
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Collapsible Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-80 bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] shadow-2xl transform transition-transform duration-300 lg:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--sidebar-border)]">
          <div className="flex items-center gap-3">
            <Image 
              src="/logo.png" 
              alt="QuickWay Logo" 
              width={40} 
              height={40}
              className="rounded-xl"
            />
            <div>
              <h2 className="text-lg font-bold text-gradient bg-gradient-to-r from-[var(--brand-aqua)] to-[var(--brand-primary)] bg-clip-text text-transparent">
                QuickWay
              </h2>
              <p className="text-xs text-[var(--text-on-navy)] opacity-70">Admin Panel</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-xl hover:bg-[var(--sidebar-hover)] transition-colors"
          >
            <X className="h-5 w-5 text-[var(--text-on-navy)]" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {sidebarItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all active:scale-95 ${
                    isActive
                      ? "bg-gradient-to-r from-[var(--brand-primary)]/20 to-[var(--brand-aqua)]/10 text-[var(--brand-aqua)] shadow-sm"
                      : "text-[var(--text-on-navy)] hover:bg-[var(--sidebar-hover)]"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? "text-[var(--brand-aqua)]" : ""}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--sidebar-border)]">
          <button
            onClick={() => signOut({ callbackUrl: "/sign-in" })}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all active:scale-95"
          >
            <LogOut className="h-5 w-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
