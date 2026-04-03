"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import AuthErrorHelper from "@/components/AuthErrorHelper";

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
      console.log('ModuleContext - Response status:', res.status, res.statusText);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('ModuleContext - Error response:', errorText);
        
        // Try to parse error response for specific handling
        let errorMessage = `Failed to fetch modules: ${res.status} ${res.statusText}`;
        let requiresReauth = false;
        let requiresSetup = false;
        
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.requiresReauth) {
            errorMessage = "Your session has expired. Please log out and log back in.";
            requiresReauth = true;
          } else if (errorData.requiresSetup) {
            errorMessage = "No user accounts found. Please contact administrator to set up accounts.";
            requiresSetup = true;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // If parsing fails, use default error message
        }
        
        // Store additional error info for potential UI handling
        setError(errorMessage);
        
        // If re-authentication is required, we could redirect to login
        if (requiresReauth) {
          console.warn('ModuleContext - Re-authentication required');
          // Could trigger a logout/redirect here if needed
        }
        
        throw new Error(errorMessage);
      }
      const data = await res.json();
      console.log('ModuleContext - Fetched modules:', data.length, 'modules');
      console.log('ModuleContext - First module:', data[0]);
      setModules(data);
      setError(null);
    } catch (err) {
      console.error('ModuleContext - Error:', err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

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
    <>
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
      
      <AuthErrorHelper 
        error={error} 
        onRetry={fetchModules}
      />
    </>
  );
}

export function useModuleContext() {
  const context = useContext(ModuleContext);
  if (context === undefined) {
    throw new Error("useModuleContext must be used within a ModuleProvider");
  }
  return context;
}
