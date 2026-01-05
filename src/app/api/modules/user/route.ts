import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MODULE_DEFINITIONS } from "@/lib/modules/registry";
import { ensureModulesSynced } from "@/lib/modules/sync";

function getIconName(icon?: string | null, fallbackIcon?: { displayName?: string; name?: string }) {
  if (icon && icon.length > 0) return icon;
  return fallbackIcon?.displayName ?? fallbackIcon?.name ?? "BarChart3";
}

export async function GET() {
  try {
    await ensureModulesSynced();

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user with role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { roleRelation: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // If user is ADMIN role (enum), give full access
    if (user.role === "ADMIN") {
      const modules = MODULE_DEFINITIONS.map((def) => ({
        moduleKey: def.key,
        moduleName: def.name,
        modulePath: def.path,
        moduleIcon: getIconName(undefined, def.icon),
        enabled: true,
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
      })).sort((a, b) => {
        const defA = MODULE_DEFINITIONS.find((def) => def.key === a.moduleKey);
        const defB = MODULE_DEFINITIONS.find((def) => def.key === b.moduleKey);
        return (defA?.sortOrder ?? 0) - (defB?.sortOrder ?? 0);
      });

      return NextResponse.json(modules);
    }

    // Get role-based permissions
    let roleId = user.roleId;

    // If no roleId, try to find role by user.role enum
    if (!roleId) {
      const roleKey = user.role.toLowerCase();
      const role = await prisma.role.findUnique({ where: { key: roleKey } });
      roleId = role?.id ?? null;
    }

    if (!roleId) {
      // No role assigned, return empty modules
      return NextResponse.json([]);
    }

    // Get modules with permissions for this role, sorted by sort order and filtered by active status and enabled permission
    const rolePermissions = await prisma.roleModulePermission.findMany({
      where: { roleId, enabled: true },
      include: { module: true },
    });

    // Get user-specific overrides
    const userOverrides = await prisma.userModulePermission.findMany({
      where: { userId: user.id },
      include: { module: true },
    });

    // Create a map of module overrides for quick lookup
    const overridesMap = new Map(userOverrides.map((override) => [
      override.moduleId,
      override,
    ]));

    // Merge role permissions with user overrides
    const userModules = rolePermissions
      .filter((rp) => rp.module.active)
      .sort((a, b) => a.module.sortOrder - b.module.sortOrder)
      .map((rp) => {
        const override = overridesMap.get(rp.moduleId);
        // If user has an override, use it; otherwise use role permission
        return {
          moduleKey: rp.module.key,
          moduleName: rp.module.name,
          modulePath: rp.module.path,
          moduleIcon: rp.module.icon,
          enabled: override ? override.enabled : rp.enabled,
          canView: override ? override.canView : rp.canView,
          canCreate: override ? override.canCreate : rp.canCreate,
          canEdit: override ? override.canEdit : rp.canEdit,
          canDelete: override ? override.canDelete : rp.canDelete,
        };
      })
      .filter((module) => module.enabled); // Only return enabled modules

    return NextResponse.json(userModules);
  } catch (error) {
    console.error("Error fetching user modules:", error);
    return NextResponse.json({ error: "Failed to fetch user modules" }, { status: 500 });
  }
}
