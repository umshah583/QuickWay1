import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const moduleKey = 'request-approvals';

  const appModule = await prisma.module.upsert({
    where: { key: moduleKey },
    update: {
      name: 'Request Approvals',
      description: 'Approve or reject partner driver/service requests',
      icon: 'GitPullRequest',
      path: '/admin/partners/driver-requests',
      sortOrder: 58,
      active: true,
    },
    create: {
      key: moduleKey,
      name: 'Request Approvals',
      description: 'Approve or reject partner driver/service requests',
      icon: 'GitPullRequest',
      path: '/admin/partners/driver-requests',
      sortOrder: 58,
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

  console.log('✅ Request Approvals module ensured and admin access granted');
}

main()
  .catch((err) => {
    console.error('❌ Failed to add Request Approvals module:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
