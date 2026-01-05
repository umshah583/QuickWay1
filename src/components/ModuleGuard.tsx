"use client";

import { useModuleContext } from "@/context/ModuleContext";
import { Loader2, ShieldX } from "lucide-react";
import Link from "next/link";

interface ModuleGuardProps {
  moduleKey: string;
  children: React.ReactNode;
  requireView?: boolean;
  requireCreate?: boolean;
  requireEdit?: boolean;
  requireDelete?: boolean;
}

export function ModuleGuard({
  moduleKey,
  children,
  requireView = true,
  requireCreate = false,
  requireEdit = false,
  requireDelete = false,
}: ModuleGuardProps) {
  const { loading, hasModule, canView, canCreate, canEdit, canDelete } = useModuleContext();

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  // Check if module is enabled
  if (!hasModule(moduleKey)) {
    return <AccessDenied message="This module is not enabled for your role." />;
  }

  // Check required permissions
  if (requireView && !canView(moduleKey)) {
    return <AccessDenied message="You don't have permission to view this module." />;
  }

  if (requireCreate && !canCreate(moduleKey)) {
    return <AccessDenied message="You don't have permission to create in this module." />;
  }

  if (requireEdit && !canEdit(moduleKey)) {
    return <AccessDenied message="You don't have permission to edit in this module." />;
  }

  if (requireDelete && !canDelete(moduleKey)) {
    return <AccessDenied message="You don't have permission to delete in this module." />;
  }

  return <>{children}</>;
}

function AccessDenied({ message }: { message: string }) {
  return (
    <div className="flex h-96 flex-col items-center justify-center gap-4">
      <div className="rounded-full bg-red-500/10 p-4">
        <ShieldX className="h-12 w-12 text-red-400" />
      </div>
      <h2 className="text-xl font-semibold text-white">Access Denied</h2>
      <p className="text-sm text-slate-400">{message}</p>
      <Link
        href="/admin"
        className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}

export function useModulePermissions(moduleKey: string) {
  const { hasModule, canView, canCreate, canEdit, canDelete } = useModuleContext();

  return {
    isEnabled: hasModule(moduleKey),
    canView: canView(moduleKey),
    canCreate: canCreate(moduleKey),
    canEdit: canEdit(moduleKey),
    canDelete: canDelete(moduleKey),
  };
}
