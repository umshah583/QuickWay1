'use client';

import { useState, useEffect } from 'react';

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

export function useModules() {
  const [modules, setModules] = useState<UserModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchModules() {
      try {
        const res = await fetch('/api/modules/user');
        if (!res.ok) {
          throw new Error('Failed to fetch modules');
        }
        const data = await res.json();
        setModules(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchModules();
  }, []);

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

  return {
    modules,
    loading,
    error,
    hasModule,
    canView,
    canCreate,
    canEdit,
    canDelete,
  };
}
