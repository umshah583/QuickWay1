import { MODULE_DEFINITIONS } from "@/lib/modules/registry";
import { prisma } from "@/lib/prisma";

let syncPromise: Promise<void> | null = null;

async function performSync() {
  // Ensure admin role exists
  const adminRole = await prisma.role.upsert({
    where: { key: "admin" },
    create: { key: "admin", name: "Administrator", description: "Full system access" },
    update: {},
  });

  for (const def of MODULE_DEFINITIONS) {
    const appModule = await prisma.module.upsert({
      where: { key: def.key },
      update: {
        name: def.name,
        description: def.description,
        icon: def.icon.displayName ?? def.icon.name ?? "BarChart3",
        path: def.path,
        sortOrder: def.sortOrder,
        active: true,
      },
      create: {
        key: def.key,
        name: def.name,
        description: def.description,
        icon: def.icon.displayName ?? def.icon.name ?? "BarChart3",
        path: def.path,
        sortOrder: def.sortOrder,
        active: true,
      },
    });

    await prisma.roleModulePermission.upsert({
      where: {
        roleId_moduleId: {
          roleId: adminRole.id,
          moduleId: appModule.id,
        },
      },
      update: {
        enabled: true,
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
      },
      create: {
        roleId: adminRole.id,
        moduleId: appModule.id,
        enabled: true,
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
      },
    });
  }
}

export async function ensureModulesSynced() {
  if (!syncPromise) {
    syncPromise = performSync().catch((error) => {
      syncPromise = null;
      throw error;
    });
  }
  await syncPromise;
}
