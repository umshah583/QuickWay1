"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";

type AdminNavProps = {
  notificationsCount?: number;
  bookingsNewCount?: number;
};

type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

type NavLink = {
  href: string;
  label: string;
  icon: NavIcon;
  badge?: number;
};

function OverviewIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true" {...props}>
      <rect x="3.75" y="3.75" width="6.5" height="6.5" rx="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="13.75" y="3.75" width="6.5" height="6.5" rx="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3.75" y="13.75" width="6.5" height="6.5" rx="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="13.75" y="13.75" width="6.5" height="6.5" rx="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TicketIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 5.75A1.75 1.75 0 013.25 7.5v2.25a1.25 1.25 0 000 2.5V14a1.75 1.75 0 001.75 1.75h13A1.75 1.75 0 0019.75 14v-1.75a1.25 1.25 0 000-2.5V7.5A1.75 1.75 0 0018 5.75H5z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 9.75l4 4.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 9.75L9 14.25" />
    </svg>
  );
}

function SparkleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3l1.5 3.5L17 8l-3.5 1.5L12 13l-1.5-3.5L7 8l3.5-1.5L12 3zM5 15l.75 1.75L7.5 18l-1.75.75L5 20.5l-.75-1.75L2.5 18l1.75-.75L5 15zm14 0l.75 1.75L21.5 18l-1.75.75L19 20.5l-.75-1.75L16.5 18l1.75-.75L19 15z"
      />
    </svg>
  );
}

function ServicesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true" {...props}>
      <rect x="4.5" y="8" width="15" height="10" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 8V6.5A1.5 1.5 0 019.5 5h5A1.5 1.5 0 0116 6.5V8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.5h6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15.5h3" />
    </svg>
  );
}

function BookingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true" {...props}>
      <rect x="4.5" y="5" width="15" height="15" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 3.75V7.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 3.75V7.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5h15" />
      <circle cx="9" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="14" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CustomersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true" {...props}>
      <circle cx="9" cy="9" r="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="15" cy="10.5" r="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19a4.5 4.5 0 019 0" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 19a4 4 0 018 0" />
    </svg>
  );
}

function NotificationsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.5 18.25a3.5 3.5 0 11-7 0m10-8.25v3.5a2 2 0 002 2H5.5a2 2 0 002-2V10a4.5 4.5 0 119 0z"
      />
    </svg>
  );
}

function CollectionsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true" {...props}>
      <ellipse cx="12" cy="7.5" rx="6" ry="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 16c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 7.5v9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v9" />
    </svg>
  );
}

function SettlementsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 9.5l8.5-4 8.5 4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 10.5v7.5h4v-5h4v5h4v-7.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 18h18" />
    </svg>
  );
}

function TransactionsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 3h3.5A1.5 1.5 0 0121 4.5v3m-8-5.5H7.5A1.5 1.5 0 006 3.5V7m15 10v3.5A1.5 1.5 0 0119.5 22H16m-10 0H3.5A1.5 1.5 0 012 20.5V17"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12h-6m0 0l2-2m-2 2l2 2" />
    </svg>
  );
}

function PartnersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.5 7.5a2.5 2.5 0 115 0 2.5 2.5 0 01-5 0zM11.5 13H8a3 3 0 00-3 3v1.5"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 7.5a2.5 2.5 0 10-5 0 2.5 2.5 0 005 0zM12.5 13H16a3 3 0 013 3v1.5"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 13h4" />
    </svg>
  );
}

function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15a3 3 0 100-6 3 3 0 000 6zm8.25-3a1.5 1.5 0 01-1.1 1.45l-.52.15a6.03 6.03 0 01-.46 1.11l.31.47a1.5 1.5 0 01-1.14 2.32h-.62a6.05 6.05 0 01-1 .58l-.1.6a1.5 1.5 0 01-1.49 1.27h-.5a1.5 1.5 0 01-1.49-1.27l-.1-.6a6.05 6.05 0 01-1-.58h-.62a1.5 1.5 0 01-1.14-2.32l.31-.47a6.03 6.03 0 01-.46-1.11l-.52-.15A1.5 1.5 0 015.75 12c0-.69.47-1.28 1.15-1.45l.52-.15c.11-.38.26-.75.46-1.11l-.31-.47a1.5 1.5 0 011.14-2.32h.62c.31-.23.65-.43 1-.58l.1-.6A1.5 1.5 0 0112.03 4h.5a1.5 1.5 0 011.49 1.27l.1.6c.35.15.69.35 1 .58h.62a1.5 1.5 0 011.14 2.32l-.31.47c.2.36.35.73.46 1.11l.52.15c.68.17 1.15.76 1.15 1.45z"
      />
    </svg>
  );
}

export default function AdminNav({ notificationsCount = 0, bookingsNewCount = 0 }: AdminNavProps) {
  const pathname = usePathname();

  const links: NavLink[] = [
    { href: "/admin", label: "Overview", icon: OverviewIcon },
    { href: "/admin/services", label: "Services", icon: ServicesIcon },
    { href: "/admin/bookings", label: "Bookings", icon: BookingsIcon, badge: bookingsNewCount },
    { href: "/admin/bookings/completed", label: "Completed orders", icon: SparkleIcon },
    { href: "/admin/coupons", label: "Coupons", icon: TicketIcon },
    { href: "/admin/users", label: "Users", icon: CustomersIcon },
    { href: "/admin/notifications", label: "Notifications", icon: NotificationsIcon, badge: notificationsCount },
    { href: "/admin/collections", label: "Collections", icon: CollectionsIcon },
    { href: "/admin/settlements", label: "Settlements", icon: SettlementsIcon },
    { href: "/admin/transactions", label: "Transactions", icon: TransactionsIcon },
    { href: "/admin/partners", label: "Partners", icon: PartnersIcon },
    { href: "/admin/partners/driver-requests", label: "Change requests", icon: SparkleIcon },
    { href: "/admin/settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <nav className="space-y-1.5">
      {links.map((link) => {
        const active = pathname === link.href;
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
              active
                ? "bg-violet-600/20 text-white shadow-sm"
                : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-3">
              <Icon className="h-5 w-5" />
              <span>{link.label}</span>
            </span>
            {link.badge ? (
              <span className="ml-3 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                {link.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
