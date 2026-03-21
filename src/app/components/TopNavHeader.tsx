"use client";

import { useState } from "react";
import { ChevronDown, BarChart3, Truck, CreditCard, Tag, Settings as SettingsIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Module categories and their icons
const categoryIcons = {
  core: BarChart3,
  operations: Truck,
  finance: CreditCard,
  marketing: Tag,
  system: SettingsIcon,
};

const categoryModules = {
  core: [
    { key: 'dashboard', name: 'Dashboard', path: '/admin' },
    { key: 'bookings', name: 'Bookings', path: '/admin/bookings' },
    { key: 'completed-bookings', name: 'Completed Bookings', path: '/admin/bookings/completed' },
    { key: 'customers', name: 'Customers', path: '/admin/customers' },
    { key: 'services', name: 'Services', path: '/admin/services' },
    { key: 'service-types', name: 'Service Types', path: '/admin/service-types' },
  ],
  operations: [
    { key: 'drivers', name: 'Drivers', path: '/admin/drivers' },
    { key: 'driver-days', name: 'Driver Days', path: '/admin/driver-days' },
    { key: 'business-day', name: 'Business Day', path: '/admin/business-day' },
    { key: 'partners', name: 'Partners', path: '/admin/partners' },
    { key: 'request-approvals', name: 'Request Approvals', path: '/admin/partners/driver-requests' },
  ],
  finance: [
    { key: 'transactions', name: 'Transactions', path: '/admin/transactions' },
    { key: 'collections', name: 'Collections', path: '/admin/collections' },
    { key: 'settlements', name: 'Settlements', path: '/admin/settlements' },
    { key: 'invoices', name: 'Invoices', path: '/admin/invoices' },
  ],
  marketing: [
    { key: 'packages', name: 'Packages', path: '/admin/packages' },
    { key: 'subscriptions', name: 'Subscriptions', path: '/admin/subscriptions' },
    { key: 'coupons', name: 'Coupons', path: '/admin/coupons' },
    { key: 'promotional-notifications', name: 'Promotional Notifications', path: '/admin/promotional-notifications' },
  ],
  system: [
    { key: 'notifications', name: 'Notifications', path: '/admin/notifications' },
    { key: 'feedback', name: 'Feedback', path: '/admin/feedback' },
    { key: 'user-management', name: 'User Management', path: '/admin/user-management' },
    { key: 'module-management', name: 'Module Management', path: '/admin/modules' },
    { key: 'settings', name: 'Settings', path: '/admin/settings' },
  ],
};

interface TopNavHeaderProps {
  className?: string;
}

export function TopNavHeader({ className = "" }: TopNavHeaderProps) {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const pathname = usePathname();

  const categories = [
    { key: 'core', name: 'Core' },
    { key: 'operations', name: 'Operations' },
    { key: 'finance', name: 'Finance' },
    { key: 'marketing', name: 'Marketing' },
    { key: 'system', name: 'System' },
  ] as const;

  const isModuleActive = (modules: typeof categoryModules.core) => {
    return modules.some(module => pathname === module.path);
  };

  return (
    <nav className={`bg-white/80 backdrop-blur-sm border-b border-[var(--surface-border)] ${className}`}>
      <div className="px-6 py-3">
        <div className="flex items-center space-x-1">
          {categories.map((category) => {
            const Icon = categoryIcons[category.key];
            const modules = categoryModules[category.key];
            const isActive = isModuleActive(modules);

            return (
              <div key={category.key} className="relative">
                <button
                  onClick={() => setActiveDropdown(activeDropdown === category.key ? null : category.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-[var(--hover-bg)] ${
                    isActive
                      ? 'bg-gradient-to-r from-[var(--brand-primary)]/20 to-[var(--brand-aqua)]/20 text-[var(--brand-primary)]'
                      : 'text-[var(--text-medium)] hover:text-[var(--brand-primary)]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{category.name}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${activeDropdown === category.key ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown */}
                {activeDropdown === category.key && (
                  <div className="absolute top-full left-0 mt-2 w-56 glass-card border border-[var(--surface-border)] rounded-xl shadow-xl overflow-hidden z-50">
                    <div className="p-2">
                      {modules.map((module) => (
                        <Link
                          key={module.key}
                          href={module.path}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all hover:bg-[var(--hover-bg)] hover:text-[var(--brand-primary)] ${
                            pathname === module.path
                              ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                              : 'text-[var(--text-medium)]'
                          }`}
                          onClick={() => setActiveDropdown(null)}
                        >
                          <span>{module.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
