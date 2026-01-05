"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

export interface UserModule {
  moduleKey: string;
  moduleName: string;
  modulePath: string;
  moduleIcon: string | null;
  enabled: boolean;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

interface ModuleContextType {
  modules: UserModule[];
  loading: boolean;
  error: string | null;
  hasModule: (moduleKey: string) => boolean;
  canView: (moduleKey: string) => boolean;
  canCreate: (moduleKey: string) => boolean;
  canEdit: (moduleKey: string) => boolean;
  canDelete: (moduleKey: string) => boolean;
  refreshModules: () => Promise<void>;
}

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

export function ModuleProvider({ children }: { children: ReactNode }) {
  const [modules, setModules] = useState<UserModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/modules/user");
      if (!res.ok) {
        throw new Error("Failed to fetch modules");
      }
      const data = await res.json();
      setModules(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchModules();
      }
    };

    const handleWindowFocus = () => fetchModules();
    const handlePermissionUpdate = () => fetchModules();

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("module-permissions-updated", handlePermissionUpdate as EventListener);

    const intervalId = window.setInterval(fetchModules, 60_000);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("module-permissions-updated", handlePermissionUpdate as EventListener);
      window.clearInterval(intervalId);
    };
  }, [fetchModules]);

  const hasModule = (moduleKey: string): boolean => {
    return modules.some((m) => m.moduleKey === moduleKey && m.enabled);
  };

  const canView = (moduleKey: string): boolean => {
    const appModule = modules.find((m) => m.moduleKey === moduleKey);
    return appModule?.canView ?? false;
  };

  const canCreate = (moduleKey: string): boolean => {
    const appModule = modules.find((m) => m.moduleKey === moduleKey);
    return appModule?.canCreate ?? false;
  };

  const canEdit = (moduleKey: string): boolean => {
    const appModule = modules.find((m) => m.moduleKey === moduleKey);
    return appModule?.canEdit ?? false;
  };

  const canDelete = (moduleKey: string): boolean => {
    const appModule = modules.find((m) => m.moduleKey === moduleKey);
    return appModule?.canDelete ?? false;
  };

  return (
    <ModuleContext.Provider
      value={{
        modules,
        loading,
        error,
        hasModule,
        canView,
        canCreate,
        canEdit,
        canDelete,
        refreshModules: fetchModules,
      }}
    >
      {children}
    </ModuleContext.Provider>
  );
}

export function useModuleContext() {
  const context = useContext(ModuleContext);
  if (context === undefined) {
    throw new Error("useModuleContext must be used within a ModuleProvider");
  }
  return context;
}
