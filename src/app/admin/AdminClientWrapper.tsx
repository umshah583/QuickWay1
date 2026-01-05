"use client";

import { ReactNode } from "react";
import { ModuleProvider } from "@/context/ModuleContext";

interface AdminClientWrapperProps {
  children: ReactNode;
}

export function AdminClientWrapper({ children }: AdminClientWrapperProps) {
  return <ModuleProvider>{children}</ModuleProvider>;
}
