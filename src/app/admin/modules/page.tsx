"use client";

import { useState, useEffect } from "react";
import { Check, X, Loader2, Shield, Eye, Plus, Edit, Trash2, Users, Settings, Save, X as Close } from "lucide-react";

interface ModulePermission {
  moduleId: string;
  moduleKey: string;
  moduleName: string;
  moduleIcon: string | null;
  modulePath: string;
  enabled: boolean;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

interface RolePermissions {
  roleId: string;
  roleKey: string;
  roleName: string;
  modules: ModulePermission[];
}

interface CustomRole {
  id: string;
  key: string;
  name: string;
  description: string | null;
  active: boolean;
  isSystemRole: boolean;
  modulePermissions: Array<{
    id: string;
    moduleId: string;
    enabled: boolean;
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    module: {
      id: string;
      key: string;
      name: string;
      icon: string | null;
    };
  }>;
  _count: {
    users: number;
  };
}

interface UserOverridesData {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    roleName: string;
  };
  modules: Array<{
    moduleId: string;
    moduleKey: string;
    moduleName: string;
    moduleIcon: string | null;
    modulePath: string;
    roleEnabled: boolean;
    roleCanView: boolean;
    roleCanCreate: boolean;
    roleCanEdit: boolean;
    roleCanDelete: boolean;
    overrideEnabled: boolean | null;
    overrideCanView: boolean | null;
    overrideCanCreate: boolean | null;
    overrideCanEdit: boolean | null;
    overrideCanDelete: boolean | null;
    hasOverride: boolean;
  }>;
}

interface ModuleData {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  path: string;
  sortOrder: number;
  active: boolean;
}

interface RoleModulePermissionData {
  id: string;
  moduleId: string;
  enabled: boolean;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

type PermissionState = Record<string, { enabled: boolean; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>;

interface UserData {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  roleId: string | null;
  createdAt: string;
}

interface UserOverrideModule {
  moduleId: string;
  moduleKey: string;
  moduleName: string;
  moduleIcon: string | null;
  modulePath: string;
  roleEnabled: boolean;
  roleCanView: boolean;
  roleCanCreate: boolean;
  roleCanEdit: boolean;
  roleCanDelete: boolean;
  overrideEnabled: boolean | null;
  overrideCanView: boolean | null;
  overrideCanCreate: boolean | null;
  overrideCanEdit: boolean | null;
  overrideCanDelete: boolean | null;
  hasOverride: boolean;
}

export default function ModulesPage() {
  const [activeTab, setActiveTab] = useState<'roles' | 'custom' | 'users'>('roles');
  const [permissions, setPermissions] = useState<RolePermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Custom roles state
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);

  // User overrides state
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [userOverrides, setUserOverrides] = useState<UserOverridesData | null>(null);
  const [loadingOverrides, setLoadingOverrides] = useState(false);

  useEffect(() => {
    if (activeTab === 'roles') {
      fetchPermissions();
    } else if (activeTab === 'custom') {
      fetchCustomRoles();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'users' && selectedUser) {
      fetchUserOverrides(selectedUser);
    }
  }, [activeTab, selectedUser]);

  async function fetchPermissions() {
    try {
      const res = await fetch("/api/modules/permissions");
      if (!res.ok) throw new Error("Failed to fetch permissions");
      const data = await res.json();
      setPermissions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function fetchCustomRoles() {
    setLoadingRoles(true);
    try {
      const res = await fetch("/api/modules/roles");
      if (!res.ok) throw new Error("Failed to fetch roles");
      const data = await res.json();
      setCustomRoles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch roles");
    } finally {
      setLoadingRoles(false);
    }
  }

  async function fetchUserOverrides(userId: string) {
    setLoadingOverrides(true);
    try {
      console.log('Fetching user overrides for userId:', userId);
      const res = await fetch(`/api/modules/user-overrides?userId=${userId}`);
      console.log('API response status:', res.status);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('API error response:', errorText);
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }
      
      const data = await res.json();
      console.log('User overrides data:', data);
      setUserOverrides(data);
    } catch (error) {
      console.error('Error fetching user overrides:', error);
      setUserOverrides(null);
      // Don't throw here, just log the error
    } finally {
      setLoadingOverrides(false);
    }
  }

  async function updatePermission(
    roleId: string,
    moduleId: string,
    field: "enabled" | "canView" | "canCreate" | "canEdit" | "canDelete",
    value: boolean
  ) {
    const key = `${roleId}-${moduleId}-${field}`;
    setSaving(key);

    // Find current permission
    const role = permissions.find((r) => r.roleId === roleId);
    const appModule = role?.modules.find((m) => m.moduleId === moduleId);
    if (!appModule) return;

    // Build update payload
    const payload = {
      roleId,
      moduleId,
      enabled: field === "enabled" ? value : appModule.enabled,
      canView: field === "canView" ? value : appModule.canView,
      canCreate: field === "canCreate" ? value : appModule.canCreate,
      canEdit: field === "canEdit" ? value : appModule.canEdit,
      canDelete: field === "canDelete" ? value : appModule.canDelete,
    };

    // If enabling a module, also enable canView
    if (field === "enabled" && value) {
      payload.canView = true;
    }

    // If disabling canView, disable all other permissions
    if (field === "canView" && !value) {
      payload.canCreate = false;
      payload.canEdit = false;
      payload.canDelete = false;
    }

    try {
      const res = await fetch("/api/modules/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to update permission");

      // Update local state
      setPermissions((prev) =>
        prev.map((r) =>
          r.roleId === roleId
            ? {
                ...r,
                modules: r.modules.map((m) =>
                  m.moduleId === moduleId ? { ...m, ...payload } : m
                ),
              }
            : r
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-500/10 p-6 text-center">
        <p className="text-red-400">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            fetchPermissions();
          }}
          className="mt-4 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Module Management</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage module permissions across roles, create custom roles, and set user-specific overrides.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-violet-400" />
          <span className="text-sm text-slate-400">Advanced Permissions</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'roles'
            ? 'border-violet-400 text-violet-400'
            : 'border-transparent text-slate-400 hover:text-white hover:border-slate-600'
          }`}
        >
          <Shield className="inline h-4 w-4 mr-2" />
          Role Permissions
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'custom'
            ? 'border-violet-400 text-violet-400'
            : 'border-transparent text-slate-400 hover:text-white hover:border-slate-600'
          }`}
        >
          <Settings className="inline h-4 w-4 mr-2" />
          Custom Roles
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'users'
            ? 'border-violet-400 text-violet-400'
            : 'border-transparent text-slate-400 hover:text-white hover:border-slate-600'
          }`}
        >
          <Users className="inline h-4 w-4 mr-2" />
          User Overrides
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'roles' && (
        <RolePermissionsTab
          permissions={permissions}
          loading={loading}
          saving={saving}
          error={error}
          onUpdatePermission={updatePermission}
          onRetry={() => {
            setError(null);
            setLoading(true);
            fetchPermissions();
          }}
        />
      )}

      {activeTab === 'custom' && (
        <CustomRolesTab
          roles={customRoles}
          loading={loadingRoles}
          onRefresh={fetchCustomRoles}
        />
      )}

      {activeTab === 'users' && (
        <UserOverridesTab
          selectedUser={selectedUser}
          userOverrides={userOverrides}
          loading={loadingOverrides}
          onUserSelect={setSelectedUser}
          onRefresh={() => selectedUser && fetchUserOverrides(selectedUser)}
        />
      )}
    </div>
  );
}

function PermissionToggle({
  checked,
  saving,
  onChange,
  disabled,
}: {
  checked: boolean;
  saving: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && !saving && onChange(!checked)}
      disabled={disabled || saving}
      className={`flex h-8 w-8 items-center justify-center rounded transition-all ${
        disabled
          ? "cursor-not-allowed bg-slate-700/30 text-slate-600"
          : checked
          ? "bg-violet-500/20 text-violet-400 hover:bg-violet-500/30"
          : "bg-slate-700/50 text-slate-500 hover:bg-slate-700"
      }`}
    >
      {saving ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : checked ? (
        <Check className="h-3 w-3" />
      ) : (
        <X className="h-3 w-3" />
      )}
    </button>
  );
}

function RolePermissionsTab({
  permissions,
  loading,
  saving,
  error,
  onUpdatePermission,
  onRetry
}: {
  permissions: RolePermissions[];
  loading: boolean;
  saving: string | null;
  error: string | null;
  onUpdatePermission: (
    roleId: string,
    moduleId: string,
    field: "enabled" | "canView" | "canCreate" | "canEdit" | "canDelete",
    value: boolean
  ) => void;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-500/10 p-6 text-center">
        <p className="text-red-400">{error}</p>
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-violet-500/20">
            <Check className="h-3 w-3 text-violet-400" />
          </div>
          <span>Enabled</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Eye className="h-4 w-4" />
          <span>View</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Plus className="h-4 w-4" />
          <span>Create</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Edit className="h-4 w-4" />
          <span>Edit</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Trash2 className="h-4 w-4" />
          <span>Delete</span>
        </div>
      </div>

      {/* Permission Matrix */}
      <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-800/50">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="sticky left-0 z-10 bg-slate-800 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                Module
              </th>
              {permissions.map((role) => (
                <th
                  key={role.roleId}
                  className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400"
                  colSpan={5}
                >
                  {role.roleName}
                </th>
              ))}
            </tr>
            <tr className="border-b border-slate-700 bg-slate-900/50">
              <th className="sticky left-0 z-10 bg-slate-900/50 px-4 py-2"></th>
              {permissions.map((role) => (
                <th key={role.roleId} colSpan={5} className="px-2 py-2">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500">
                    <span className="w-8">On</span>
                    <span className="w-8">
                      <Eye className="mx-auto h-3 w-3" />
                    </span>
                    <span className="w-8">
                      <Plus className="mx-auto h-3 w-3" />
                    </span>
                    <span className="w-8">
                      <Edit className="mx-auto h-3 w-3" />
                    </span>
                    <span className="w-8">
                      <Trash2 className="mx-auto h-3 w-3" />
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions[0]?.modules.map((module, idx) => (
              <tr
                key={module.moduleId}
                className={`border-b border-slate-700/50 ${
                  idx % 2 === 0 ? "bg-slate-800/30" : "bg-slate-800/10"
                }`}
              >
                <td className="sticky left-0 z-10 bg-inherit px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{module.moduleName}</span>
                    <span className="text-xs text-slate-500">{module.modulePath}</span>
                  </div>
                </td>
                {permissions.map((role) => {
                  const mod = role.modules.find((m) => m.moduleId === module.moduleId);
                  if (!mod) return null;

                  return (
                    <td key={`${role.roleId}-${mod.moduleId}`} colSpan={5} className="px-2 py-2">
                      <div className="flex items-center justify-center gap-1">
                        {/* Enabled toggle */}
                        <PermissionToggle
                          checked={mod.enabled}
                          saving={saving === `${role.roleId}-${mod.moduleId}-enabled`}
                          onChange={(v) => onUpdatePermission(role.roleId, mod.moduleId, "enabled", v)}
                          disabled={role.roleKey === "admin"}
                        />
                        {/* View */}
                        <PermissionToggle
                          checked={mod.canView}
                          saving={saving === `${role.roleId}-${mod.moduleId}-canView`}
                          onChange={(v) => onUpdatePermission(role.roleId, mod.moduleId, "canView", v)}
                          disabled={role.roleKey === "admin" || !mod.enabled}
                        />
                        {/* Create */}
                        <PermissionToggle
                          checked={mod.canCreate}
                          saving={saving === `${role.roleId}-${mod.moduleId}-canCreate`}
                          onChange={(v) => onUpdatePermission(role.roleId, mod.moduleId, "canCreate", v)}
                          disabled={role.roleKey === "admin" || !mod.canView}
                        />
                        {/* Edit */}
                        <PermissionToggle
                          checked={mod.canEdit}
                          saving={saving === `${role.roleId}-${mod.moduleId}-canEdit`}
                          onChange={(v) => onUpdatePermission(role.roleId, mod.moduleId, "canEdit", v)}
                          disabled={role.roleKey === "admin" || !mod.canView}
                        />
                        {/* Delete */}
                        <PermissionToggle
                          checked={mod.canDelete}
                          saving={saving === `${role.roleId}-${mod.moduleId}-canDelete`}
                          onChange={(v) => onUpdatePermission(role.roleId, mod.moduleId, "canDelete", v)}
                          disabled={role.roleKey === "admin" || !mod.canView}
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-center text-xs text-slate-500">
        Admin role has full access to all modules and cannot be modified.
      </p>
    </div>
  );
}

function CustomRolesTab({
  roles,
  loading,
  onRefresh
}: {
  roles: CustomRole[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [modulePermissions, setModulePermissions] = useState<PermissionState>({});
  const [saving, setSaving] = useState(false);
  const [modules, setModules] = useState<ModuleData[]>([]);

  // Fetch modules on mount
  useEffect(() => {
    fetchModules();
  }, []);

  async function fetchModules() {
    try {
      const res = await fetch('/api/modules');
      if (res.ok) {
        const data = await res.json();
        setModules(data);
        // Initialize permissions
        const perms: PermissionState = {};
        data.forEach((mod: ModuleData) => {
          perms[mod.id] = { enabled: false, canView: false, canCreate: false, canEdit: false, canDelete: false };
        });
        setModulePermissions(perms);
      }
    } catch (error) {
      console.error('Failed to fetch modules:', error);
    }
  }

  function resetForm() {
    setRoleName('');
    setRoleDescription('');
    setModulePermissions({});
    setEditingRole(null);
    setShowCreateForm(false);
  }

  function startEdit(role: CustomRole) {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDescription(role.description || '');
    
    // Initialize permissions from role
    const perms: PermissionState = {};
    modules.forEach((mod) => {
      const rolePerm = role.modulePermissions?.find((rp: RoleModulePermissionData) => rp.moduleId === mod.id);
      perms[mod.id] = {
        enabled: rolePerm?.enabled ?? false,
        canView: rolePerm?.canView ?? false,
        canCreate: rolePerm?.canCreate ?? false,
        canEdit: rolePerm?.canEdit ?? false,
        canDelete: rolePerm?.canDelete ?? false,
      };
    });
    setModulePermissions(perms);
  }

  async function saveRole() {
    if (!roleName.trim()) return;
    
    setSaving(true);
    try {
      const payload = {
        name: roleName.trim(),
        description: roleDescription.trim(),
        modulePermissions: Object.entries(modulePermissions).map(([moduleId, perms]) => ({
          moduleId,
          ...perms,
        })),
      };

      const method = editingRole ? 'PUT' : 'POST';
      const url = editingRole ? `/api/modules/roles/${editingRole.id}` : '/api/modules/roles';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        resetForm();
        onRefresh();
      } else {
        let errorMessage = 'Unknown error';
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || 'Unknown error';
          console.error('Failed to save role:', res.status, errorData);
        } catch {
          const errorText = await res.text();
          console.error('Failed to save role:', res.status, errorText);
          errorMessage = errorText || `HTTP ${res.status}`;
        }
        alert(`Failed to save role: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error saving role:', error);
      alert(`Error saving role: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRole(roleId: string) {
    if (!confirm('Are you sure you want to delete this role?')) return;
    
    try {
      const res = await fetch(`/api/modules/roles/${roleId}`, { method: 'DELETE' });
      if (res.ok) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error deleting role:', error);
    }
  }

  function updateModulePermission(moduleId: string, field: string, value: boolean) {
    setModulePermissions(prev => ({
      ...prev,
      [moduleId]: {
        ...prev[moduleId],
        [field]: value,
        // Auto-enable view when enabling module
        ...(field === 'enabled' && value ? { canView: true } : {}),
        // Disable other permissions when disabling view
        ...(field === 'canView' && !value ? { canCreate: false, canEdit: false, canDelete: false } : {}),
      },
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Custom Roles</h2>
          <p className="text-sm text-slate-400">Create and manage custom roles with specific module permissions</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRefresh}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700"
          >
            Refresh
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600"
          >
            <Plus className="inline h-4 w-4 mr-2" />
            New Role
          </button>
        </div>
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || editingRole) && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">
              {editingRole ? 'Edit Role' : 'Create New Role'}
            </h3>
            <button
              onClick={resetForm}
              className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
            >
              <Close className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Role Name</label>
              <input
                type="text"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-violet-400 focus:outline-none"
                placeholder="Enter role name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Description (Optional)</label>
              <textarea
                value={roleDescription}
                onChange={(e) => setRoleDescription(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-violet-400 focus:outline-none"
                placeholder="Enter role description"
                rows={3}
              />
            </div>
          </div>

          <div className="mb-6">
            <h4 className="text-md font-semibold text-white mb-3">Module Permissions</h4>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {modules.map((module) => (
                <div key={module.id} className="rounded-lg border border-slate-600 bg-slate-700/50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-white">{module.name}</span>
                    <span className="text-xs text-slate-400">{module.path}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={modulePermissions[module.id]?.enabled ?? false}
                        onChange={(e) => updateModulePermission(module.id, 'enabled', e.target.checked)}
                        className="rounded border-slate-600 bg-slate-700 text-violet-400 focus:ring-violet-400"
                      />
                      Enabled
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={modulePermissions[module.id]?.canView ?? false}
                        onChange={(e) => updateModulePermission(module.id, 'canView', e.target.checked)}
                        disabled={!modulePermissions[module.id]?.enabled}
                        className="rounded border-slate-600 bg-slate-700 text-violet-400 focus:ring-violet-400 disabled:opacity-50"
                      />
                      View
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={modulePermissions[module.id]?.canCreate ?? false}
                        onChange={(e) => updateModulePermission(module.id, 'canCreate', e.target.checked)}
                        disabled={!modulePermissions[module.id]?.canView}
                        className="rounded border-slate-600 bg-slate-700 text-violet-400 focus:ring-violet-400 disabled:opacity-50"
                      />
                      Create
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={modulePermissions[module.id]?.canEdit ?? false}
                        onChange={(e) => updateModulePermission(module.id, 'canEdit', e.target.checked)}
                        disabled={!modulePermissions[module.id]?.canView}
                        className="rounded border-slate-600 bg-slate-700 text-violet-400 focus:ring-violet-400 disabled:opacity-50"
                      />
                      Edit
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={modulePermissions[module.id]?.canDelete ?? false}
                        onChange={(e) => updateModulePermission(module.id, 'canDelete', e.target.checked)}
                        disabled={!modulePermissions[module.id]?.canView}
                        className="rounded border-slate-600 bg-slate-700 text-violet-400 focus:ring-violet-400 disabled:opacity-50"
                      />
                      Delete
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={resetForm}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={saveRole}
              disabled={saving || !roleName.trim()}
              className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="inline h-4 w-4 animate-spin mr-2" /> : <Save className="inline h-4 w-4 mr-2" />}
              {editingRole ? 'Update Role' : 'Create Role'}
            </button>
          </div>
        </div>
      )}

      {/* Roles List */}
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
        </div>
      ) : roles.length === 0 ? (
        <div className="text-center text-slate-400 py-8">
          No custom roles created yet. Click &quot;New Role&quot; to create your first custom role.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <div key={role.id} className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-white">{role.name}</h3>
                  {role.description && (
                    <p className="text-sm text-slate-400 mt-1">{role.description}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => startEdit(role)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
                    title="Edit role"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteRole(role.id)}
                    className="rounded p-1 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                    title="Delete role"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-400">
                <span>{role._count?.users ?? 0} users</span>
                <span>{role.modulePermissions?.filter((p: RoleModulePermissionData) => p.enabled).length ?? 0} modules enabled</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UserOverridesTab({
  selectedUser,
  userOverrides,
  loading,
  onUserSelect,
  onRefresh
}: {
  selectedUser: string;
  userOverrides: UserOverridesData | null;
  loading: boolean;
  onUserSelect: (userId: string) => void;
  onRefresh: () => void;
}) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [savingOverride, setSavingOverride] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch users on mount
  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/users?limit=100'); // Assuming there's a users API
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function updateUserOverride(userId: string, moduleId: string, field: string, value: boolean) {
    const key = `${userId}-${moduleId}-${field}`;
    setSavingOverride(key);

    try {
      const res = await fetch('/api/modules/user-overrides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, moduleId, [field]: value }),
      });

      if (res.ok) {
        onRefresh();
      } else {
        console.error('Failed to update user override');
      }
    } catch (error) {
      console.error('Error updating user override:', error);
    } finally {
      setSavingOverride(null);
    }
  }

  async function removeUserOverride(userId: string, moduleId: string) {
    try {
      const res = await fetch(`/api/modules/user-overrides?userId=${userId}&moduleId=${moduleId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        onRefresh();
      } else {
        console.error('Failed to remove user override');
      }
    } catch (error) {
      console.error('Error removing user override:', error);
    }
  }

  const filteredUsers = users.filter(user =>
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">User-Specific Overrides</h2>
          <p className="text-sm text-slate-400">Override module permissions for individual users</p>
        </div>
        <button
          onClick={onRefresh}
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* User Selection */}
        <div className="lg:col-span-1">
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Select User</h3>
            
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-violet-400 focus:outline-none"
              />
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2">
              {loadingUsers ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center text-slate-400 py-4">
                  No users found
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => onUserSelect(user.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedUser === user.id
                        ? 'border-violet-400 bg-violet-500/10 text-violet-300'
                        : 'border-slate-600 bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <div className="font-medium">{user.name || 'No name'}</div>
                    <div className="text-sm text-slate-400">{user.email}</div>
                    <div className="text-xs text-slate-500 mt-1">Role: {user.role}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* User Permissions */}
        <div className="lg:col-span-2">
          {!selectedUser ? (
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-8 text-center">
              <Users className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">Select a user to manage their module overrides</p>
            </div>
          ) : loading ? (
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-8 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
            </div>
          ) : !userOverrides ? (
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-8 text-center">
              <p className="text-slate-400">Failed to load user permissions</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                <h3 className="text-lg font-semibold text-white mb-2">{userOverrides.user.name}</h3>
                <p className="text-sm text-slate-400">{userOverrides.user.email} • Role: {userOverrides.user.roleName}</p>
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                <h4 className="text-md font-semibold text-white mb-4">Module Permissions</h4>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {userOverrides.modules.map((appModule: UserOverrideModule) => (
                    <div key={appModule.moduleId} className="rounded-lg border border-slate-600 bg-slate-700/50 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <span className="font-medium text-white">{appModule.moduleName}</span>
                          <span className="text-xs text-slate-400 ml-2">{appModule.modulePath}</span>
                        </div>
                        {appModule.hasOverride && (
                          <button
                            onClick={() => removeUserOverride(selectedUser, appModule.moduleId)}
                            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-500/30 hover:bg-red-500/10"
                            title="Remove override (revert to role permission)"
                          >
                            Reset
                          </button>
                        )}
                      </div>

                      {/* Role permissions (read-only) */}
                      <div className="mb-3 p-2 rounded bg-slate-800/50">
                        <div className="text-xs text-slate-500 mb-1">Role permissions:</div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className={appModule.roleEnabled ? 'text-green-400' : 'text-red-400'}>
                            {appModule.roleEnabled ? '✓' : '✗'} Enabled
                          </span>
                          <span className={appModule.roleCanView ? 'text-green-400' : 'text-red-400'}>
                            {appModule.roleCanView ? '✓' : '✗'} View
                          </span>
                          <span className={appModule.roleCanCreate ? 'text-green-400' : 'text-red-400'}>
                            {appModule.roleCanCreate ? '✓' : '✗'} Create
                          </span>
                          <span className={appModule.roleCanEdit ? 'text-green-400' : 'text-red-400'}>
                            {appModule.roleCanEdit ? '✓' : '✗'} Edit
                          </span>
                          <span className={appModule.roleCanDelete ? 'text-green-400' : 'text-red-400'}>
                            {appModule.roleCanDelete ? '✓' : '✗'} Delete
                          </span>
                        </div>
                      </div>

                      {/* User overrides */}
                      <div>
                        <div className="text-xs text-violet-400 mb-2">User overrides:</div>
                        <div className="flex items-center gap-4">
                          <PermissionToggle
                            checked={appModule.overrideEnabled ?? appModule.roleEnabled}
                            saving={savingOverride === `${selectedUser}-${appModule.moduleId}-enabled`}
                            onChange={(v) => updateUserOverride(selectedUser, appModule.moduleId, 'enabled', v)}
                          />
                          <PermissionToggle
                            checked={appModule.overrideCanView ?? appModule.roleCanView}
                            saving={savingOverride === `${selectedUser}-${appModule.moduleId}-canView`}
                            onChange={(v) => updateUserOverride(selectedUser, appModule.moduleId, 'canView', v)}
                          />
                          <PermissionToggle
                            checked={appModule.overrideCanCreate ?? appModule.roleCanCreate}
                            saving={savingOverride === `${selectedUser}-${appModule.moduleId}-canCreate`}
                            onChange={(v) => updateUserOverride(selectedUser, appModule.moduleId, 'canCreate', v)}
                          />
                          <PermissionToggle
                            checked={appModule.overrideCanEdit ?? appModule.roleCanEdit}
                            saving={savingOverride === `${selectedUser}-${appModule.moduleId}-canEdit`}
                            onChange={(v) => updateUserOverride(selectedUser, appModule.moduleId, 'canEdit', v)}
                          />
                          <PermissionToggle
                            checked={appModule.overrideCanDelete ?? appModule.roleCanDelete}
                            saving={savingOverride === `${selectedUser}-${appModule.moduleId}-canDelete`}
                            onChange={(v) => updateUserOverride(selectedUser, appModule.moduleId, 'canDelete', v)}
                          />
                        </div>
                        {appModule.hasOverride && (
                          <div className="text-xs text-violet-400 mt-1">* This user has custom permissions</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
