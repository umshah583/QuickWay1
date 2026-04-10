"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession, signIn, signOut } from "next-auth/react";
import ThemeSwitcher from "./ThemeSwitcher";
import { useCategoryNavigation } from "@/context/CategoryNavigationContext";
import { CATEGORY_DEFINITIONS } from "@/lib/modules/categoryNavigation";

type RoleVariant = "CLIENT" | "DRIVER" | "PARTNER" | "ADMIN" | "GUEST";

function resolveRoleVariant(sessionStatus: string, role?: string | null, roleKey?: string | null): RoleVariant {
  if (sessionStatus !== "authenticated") {
    return "GUEST";
  }
  // Use roleKey for admin-like roles (admin, manager, etc.)
  const key = roleKey?.toLowerCase() ?? role?.toLowerCase();
  if (key === "admin" || key === "manager") {
    return "ADMIN";
  }
  if (key === "driver") {
    return "DRIVER";
  }
  if (key === "partner") {
    return "PARTNER";
  }
  return "CLIENT";
}

export default function Header() {
  const { data: session, status } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;
  const roleKey = (session?.user as { roleKey?: string } | undefined)?.roleKey ?? null;
  const [hydrated, setHydrated] = useState(false);
  const { selectedCategory, setSelectedCategory } = useCategoryNavigation();

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return (
      <header className="sticky top-0 z-50 border-b border-[var(--surface-border)] bg-[var(--glass-bg)] backdrop-blur-xl supports-[backdrop-filter]:bg-[color-mix(in_srgb,_var(--surface),_transparent_10%)] shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 text-[var(--text-strong)]">
          <Link href="/" className="group flex items-center gap-3">
            <Image 
              src="/logo.png" 
              alt="QuickWay Logo" 
              width={40} 
              height={40}
              className="transition-transform group-hover:scale-105"
            />
            <span className="font-bold text-xl tracking-tight text-[var(--text-strong)] group-hover:text-[var(--brand-primary)] transition-colors">
              QuickWay
            </span>
          </Link>
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] animate-pulse">Loading…</span>
        </div>
      </header>
    );
  }

  const variant = resolveRoleVariant(status, role, roleKey);
  const isLoading = status === "loading";

  let primaryLinks: React.ReactNode;
  if (variant === "ADMIN") {
    primaryLinks = (
      <div className="flex items-center gap-1">
        {CATEGORY_DEFINITIONS.map((category) => {
          const modules = category.modules;
          const active = selectedCategory === category.key;
          const targetPath = modules[0]?.path ?? "/admin";

          return (
            <Link
              key={category.key}
              href={targetPath}
              onClick={() => setSelectedCategory(category.key)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all hover:bg-[var(--surface-hover)] ${
                active ? "text-[var(--brand-primary)] bg-[var(--surface-hover)]" : "text-[var(--text-medium)]"
              }`}
            >
              {category.name}
            </Link>
          );
        })}
      </div>
    );
  } else if (variant === "DRIVER") {
    primaryLinks = (
      <Link href="/driver" className="px-3 py-2 rounded-lg transition-all hover:text-[var(--brand-primary)] hover:bg-[var(--surface-hover)]">
        Console
      </Link>
    );
  } else if (variant === "PARTNER") {
    primaryLinks = (
      <Link href="/partner" className="px-3 py-2 rounded-lg transition-all hover:text-[var(--brand-primary)] hover:bg-[var(--surface-hover)]">
        Dashboard
      </Link>
    );
  } else {
    primaryLinks = (
      <>
        <Link href="/services" className="px-3 py-2 rounded-lg transition-all hover:text-[var(--brand-primary)] hover:bg-[var(--surface-hover)]">
          Services
        </Link>
        <Link href="/booking" className="px-4 py-2 rounded-lg bg-[var(--primary-gradient)] text-white font-semibold shadow-md shadow-[var(--brand-primary)]/30 transition-all hover:scale-105 hover:shadow-lg">
          Book Now
        </Link>
      </>
    );
  }

  let authControls: React.ReactNode;
  if (status === "authenticated") {
    if (variant === "ADMIN") {
      authControls = null;
    } else {
      authControls = (
        <>
          {variant === "CLIENT" ? (
            <Link href="/account" className="px-3 py-2 rounded-lg transition-all hover:text-[var(--brand-primary)] hover:bg-[var(--surface-hover)]">
              Account
            </Link>
          ) : null}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-lg border border-[var(--surface-border)] px-4 py-2 text-[var(--text-strong)] font-medium transition-all hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] hover:bg-[var(--surface-hover)]"
          >
            Sign Out
          </button>
        </>
      );
    }
  } else if (status !== "loading") {
    authControls = (
      <button
        onClick={() => signIn()}
        className="rounded-lg bg-[var(--primary-gradient)] px-5 py-2 font-semibold text-white shadow-md shadow-[var(--brand-primary)]/30 transition-all hover:scale-105 hover:shadow-lg"
      >
        Sign In
      </button>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--surface-border)] bg-[var(--glass-bg)] backdrop-blur-xl supports-[backdrop-filter]:bg-[color-mix(in_srgb,_var(--surface),_transparent_10%)] shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 text-[var(--text-strong)]">
        <Link href="/" className="group flex items-center gap-3">
          <Image 
            src="/logo.png" 
            alt="QuickWay Logo" 
            width={40} 
            height={40}
            className="transition-transform group-hover:scale-105"
          />
          <span className="font-bold text-xl tracking-tight text-[var(--text-strong)] group-hover:text-[var(--brand-primary)] transition-colors">
            QuickWay
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-[var(--text-medium)]">
          {isLoading ? (
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-medium)] animate-pulse">Loading…</span>
          ) : (
            <>
              {primaryLinks}
              {authControls}
              <ThemeSwitcher />
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
