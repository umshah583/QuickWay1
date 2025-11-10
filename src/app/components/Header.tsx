"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import ThemeSwitcher from "./ThemeSwitcher";

type RoleVariant = "CLIENT" | "DRIVER" | "PARTNER" | "ADMIN" | "GUEST";

function resolveRoleVariant(sessionStatus: string, role?: string | null): RoleVariant {
  if (sessionStatus !== "authenticated") {
    return "GUEST";
  }
  if (role === "ADMIN") {
    return "ADMIN";
  }
  if (role === "DRIVER") {
    return "DRIVER";
  }
  if (role === "PARTNER") {
    return "PARTNER";
  }
  return "CLIENT";
}

export default function Header() {
  const { data: session, status } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return (
      <header className="border-b border-[var(--surface-border)] bg-[var(--surface)] backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_srgb,_var(--surface),_transparent_20%)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 text-[var(--text-strong)]">
          <Link href="/" className="font-semibold text-xl uppercase tracking-[0.3em] text-[var(--brand-primary)]">
            Quickway
          </Link>
          <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Loading…</span>
        </div>
      </header>
    );
  }

  const variant = resolveRoleVariant(status, role);
  const isLoading = status === "loading";

  let primaryLinks: React.ReactNode;
  if (variant === "ADMIN") {
    primaryLinks = (
      <>
        <Link href="/admin" className="transition hover:text-[var(--brand-primary)]">
          Admin dashboard
        </Link>
        <Link href="/admin/collections" className="transition hover:text-[var(--brand-primary)]">
          Collections
        </Link>
      </>
    );
  } else if (variant === "DRIVER") {
    primaryLinks = (
      <Link href="/driver" className="transition hover:text-[var(--brand-primary)]">
        Driver console
      </Link>
    );
  } else if (variant === "PARTNER") {
    primaryLinks = (
      <Link href="/partner" className="transition hover:text-[var(--brand-primary)]">
        Partner dashboard
      </Link>
    );
  } else {
    primaryLinks = (
      <>
        <Link href="/services" className="transition hover:text-[var(--brand-primary)]">
          Services
        </Link>
        <Link href="/booking" className="transition hover:text-[var(--brand-primary)]">
          Book
        </Link>
      </>
    );
  }

  let authControls: React.ReactNode;
  if (status === "authenticated") {
    authControls = (
      <>
        {variant === "CLIENT" ? (
          <Link href="/account" className="transition hover:text-[var(--brand-primary)]">
            Account
          </Link>
        ) : null}
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="rounded-full border border-[var(--outline-button-border)] px-4 py-1.5 text-[var(--outline-button-text)] transition hover:border-transparent hover:bg-[var(--brand-primary)] hover:text-white"
        >
          Sign out
        </button>
      </>
    );
  } else if (status !== "loading") {
    authControls = (
      <button
        onClick={() => signIn()}
        className="rounded-full border border-[var(--outline-button-border)] px-4 py-1.5 text-[var(--outline-button-text)] transition hover:border-transparent hover:bg-[var(--brand-primary)] hover:text-white"
      >
        Sign in
      </button>
    );
  }

  return (
    <header className="border-b border-[var(--surface-border)] bg-[var(--surface)] backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_srgb,_var(--surface),_transparent_20%)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 text-[var(--text-strong)]">
        <Link href="/" className="font-semibold text-xl uppercase tracking-[0.3em] text-[var(--brand-primary)]">
          Quickway
        </Link>
        <nav className="flex items-center gap-4 text-sm text-[var(--text-muted)]">
          {isLoading ? (
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Loading…</span>
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
