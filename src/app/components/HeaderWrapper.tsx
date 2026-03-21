"use client";

import { usePathname } from "next/navigation";
import Header from "./Header";

const HIDDEN_ROUTES = new Set(["/sign-in"]);

export default function HeaderWrapper() {
  const pathname = usePathname();

  if (pathname && HIDDEN_ROUTES.has(pathname)) {
    return null;
  }

  return (
    <div className="print:hidden">
      <Header />
    </div>
  );
}
