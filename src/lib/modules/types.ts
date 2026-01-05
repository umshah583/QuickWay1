import type { Module, RoleModulePermission, Role } from '@prisma/client';

export interface ModuleWithPermissions extends Module {
  rolePermissions: RoleModulePermission[];
}

export interface RoleWithModules extends Role {
  modulePermissions: (RoleModulePermission & {
    module: Module;
  })[];
}

export interface UserModuleAccess {
  moduleKey: string;
  moduleName: string;
  modulePath: string;
  moduleIcon: string;
  enabled: boolean;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface ModulePermissionMatrix {
  roleId: string;
  roleName: string;
  modules: {
    moduleId: string;
    moduleKey: string;
    moduleName: string;
    enabled: boolean;
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  }[];
}
