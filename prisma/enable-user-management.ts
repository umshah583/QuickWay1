import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const moduleKey = 'user-management';

  const appModule = await prisma.module.upsert({
    where: { key: moduleKey },
    update: { active: true },
    create: {
      key: moduleKey,
      name: 'User Management',
      description: 'Manage internal users and roles',
      icon: 'Shield',
      path: '/admin/user-management',
      sortOrder: 110,
      active: true,
    },
  });

  const adminRole = await prisma.role.findUnique({ where: { key: 'admin' } });
  if (!adminRole) {
    throw new Error('Admin role not found');
  }

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

  console.log('✅ User Management module ensured active and admin has full access');

  await prisma.$disconnect();
}

run().catch(async (err) => {
  console.error('❌ Failed to enable user management:', err);
  await prisma.$disconnect();
  process.exit(1);
});
