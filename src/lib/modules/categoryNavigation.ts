export type ModuleCategoryKey = "core" | "operations" | "finance" | "marketing" | "system";

export interface CategoryModuleLink {
  key: string;
  name: string;
  path: string;
}

export interface CategoryDefinition {
  key: ModuleCategoryKey;
  name: string;
  modules: CategoryModuleLink[];
}

export const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    key: "core",
    name: "Core",
    modules: [
      { key: "dashboard", name: "Dashboard", path: "/admin" },
      { key: "bookings", name: "Bookings", path: "/admin/bookings" },
      { key: "completed-bookings", name: "Completed Bookings", path: "/admin/bookings/completed" },
      { key: "customers", name: "Customers", path: "/admin/customers" },
      { key: "services", name: "Services", path: "/admin/services" },
      { key: "service-types", name: "Service Types", path: "/admin/service-types" },
    ],
  },
  {
    key: "operations",
    name: "Operations",
    modules: [
      { key: "drivers", name: "Drivers", path: "/admin/drivers" },
      { key: "driver-days", name: "Driver Days", path: "/admin/driver-days" },
      { key: "business-day", name: "Business Day", path: "/admin/business-day" },
      { key: "partners", name: "Partners", path: "/admin/partners" },
      { key: "request-approvals", name: "Request Approvals", path: "/admin/partners/driver-requests" },
    ],
  },
  {
    key: "finance",
    name: "Finance",
    modules: [
      { key: "finance", name: "Finance", path: "/admin/finance" },
      { key: "transactions", name: "Transactions", path: "/admin/transactions" },
      { key: "collections", name: "Collections", path: "/admin/collections" },
      { key: "settlements", name: "Settlements", path: "/admin/settlements" },
      { key: "invoices", name: "Invoices", path: "/admin/invoices" },
    ],
  },
  {
    key: "marketing",
    name: "Marketing",
    modules: [
      { key: "packages", name: "Packages", path: "/admin/packages" },
      { key: "subscriptions", name: "Subscriptions", path: "/admin/subscriptions" },
      { key: "coupons", name: "Coupons", path: "/admin/coupons" },
      { key: "promotional-notifications", name: "Promotional Notifications", path: "/admin/promotional-notifications" },
      { key: "promotion", name: "Promotion", path: "/admin/promotion" },
      { key: "loyalty", name: "Loyalty", path: "/admin/loyalty" },
    ],
  },
  {
    key: "system",
    name: "System",
    modules: [
      { key: "notifications", name: "Notifications", path: "/admin/notifications" },
      { key: "notification-center", name: "Event Center", path: "/admin/notification-center" },
      { key: "feedback", name: "Feedback", path: "/admin/feedback" },
      { key: "user-management", name: "User Management", path: "/admin/user-management" },
      { key: "module-management", name: "Module Management", path: "/admin/modules" },
      { key: "settings", name: "Settings", path: "/admin/settings" },
      { key: "users", name: "Users", path: "/admin/users" },
      { key: "zones", name: "Zones", path: "/admin/zones" },
      { key: "areas", name: "Areas", path: "/admin/areas" },
      { key: "analytics", name: "Analytics", path: "/admin/analytics" },
      { key: "live-tracking", name: "Live Tracking", path: "/admin/live-tracking" },
      { key: "profile", name: "Profile", path: "/admin/profile" },
    ],
  },
];

export const CATEGORY_MODULE_MAP = CATEGORY_DEFINITIONS.reduce(
  (acc, def) => {
    acc[def.key] = def.modules;
    return acc;
  },
  {} as Record<ModuleCategoryKey, CategoryModuleLink[]>
);

const MODULE_KEY_TO_CATEGORY = CATEGORY_DEFINITIONS.reduce((acc, def) => {
  def.modules.forEach((module) => {
    acc[normalizeModuleKey(module.key)] = def.key;
  });
  return acc;
}, {} as Record<string, ModuleCategoryKey>);

const DEFAULT_CATEGORY: ModuleCategoryKey = "core";

export function getCategoryForModuleKey(moduleKey: string): ModuleCategoryKey {
  return MODULE_KEY_TO_CATEGORY[normalizeModuleKey(moduleKey)] ?? DEFAULT_CATEGORY;
}

export function resolveModuleCategory(moduleKey: string, modulePath?: string): ModuleCategoryKey {
  const normalizedKey = normalizeModuleKey(moduleKey);
  const category = MODULE_KEY_TO_CATEGORY[normalizedKey];
  if (category) {
    return category;
  }

  if (modulePath) {
    return getCategoryForPath(modulePath);
  }

  return DEFAULT_CATEGORY;
}

export function getCategoryForPath(pathname: string | null | undefined): ModuleCategoryKey {
  if (!pathname) {
    return DEFAULT_CATEGORY;
  }

  for (const def of CATEGORY_DEFINITIONS) {
    for (const mod of def.modules) {
      if (pathname === mod.path || pathname.startsWith(`${mod.path}/`)) {
        return def.key;
      }
    }
  }

  return DEFAULT_CATEGORY;
}

function normalizeModuleKey(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}
