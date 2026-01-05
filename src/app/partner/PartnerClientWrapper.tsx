"use client";

import { ReactNode } from "react";
import { ModuleProvider } from "@/context/ModuleContext";

interface PartnerClientWrapperProps {
  children: ReactNode;
}

export function PartnerClientWrapper({ children }: PartnerClientWrapperProps) {
  return <ModuleProvider>{children}</ModuleProvider>;
}
