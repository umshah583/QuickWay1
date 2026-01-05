"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useModules } from "@/hooks/useModules";
import {
  Calendar,
  Users,
  Car,
  Settings,
  CreditCard,
  Bell,
  Package,
  Building2,
  MessageSquare,
  FileText,
  Wallet,
  Clock,
  UserCog,
  Tag,
  Layers,
  BarChart3,
  Shield,
  Loader2,
  type LucideIcon,
} from "lucide-react";

type ModularAdminNavProps = {
  notificationsCount?: number;
  bookingsNewCount?: number;
};

const ICON_MAP: Record<string, LucideIcon> = {
  Calendar,
  Users,
  Car,
  Settings,
  CreditCard,
  Bell,
  Package,
  Building2,
  MessageSquare,
  FileText,
  Wallet,
  Clock,
  UserCog,
  Tag,
  Layers,
  BarChart3,
  Shield,
};

function getIcon(iconName: string | null): LucideIcon {
  if (!iconName) return BarChart3;
  return ICON_MAP[iconName] || BarChart3;
}

export default function ModularAdminNav({ notificationsCount = 0, bookingsNewCount = 0 }: ModularAdminNavProps) {
  const pathname = usePathname();
  const { modules, loading, error } = useModules();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-500/10 p-4 text-center text-sm text-red-400">
        Failed to load modules
      </div>
    );
  }

  // Filter to only enabled modules with view permission
  const enabledModules = modules.filter((m) => m.enabled && m.canView);

  // Get badge counts for specific modules
  const getBadge = (moduleKey: string): number | undefined => {
    if (moduleKey === "bookings") return bookingsNewCount || undefined;
    if (moduleKey === "notifications") return notificationsCount || undefined;
    return undefined;
  };

  return (
    <nav className="space-y-1.5">
      {enabledModules.map((module) => {
        const active = pathname === module.modulePath || pathname?.startsWith(`${module.modulePath}/`);
        const Icon = getIcon(module.moduleIcon);
        const badge = getBadge(module.moduleKey);

        return (
          <Link
            key={module.moduleKey}
            href={module.modulePath}
            className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
              active
                ? "bg-violet-600/20 text-white shadow-sm"
                : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-3">
              <Icon className="h-5 w-5" />
              <span>{module.moduleName}</span>
            </span>
            {badge ? (
              <span className="ml-3 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                {badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
