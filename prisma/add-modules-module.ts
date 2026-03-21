import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  // Add Module Management module
  await prisma.module.upsert({
    where: { key: 'modules' },
    update: {},
    create: {
      id: 'module-management',
      key: 'modules',
      name: 'Module Management',
      description: 'Manage system modules and role permissions',
      icon: 'Shield',
      path: '/admin/modules',
      sortOrder: 115,
      updatedAt: new Date(),
    },
  });

  // Give admin role full access
  const adminRole = await prisma.role.findUnique({ where: { key: 'admin' } });
  if (adminRole) {
    const mod = await prisma.module.findUnique({ where: { key: 'modules' } });
    if (mod) {
      await prisma.roleModulePermission.upsert({
        where: { roleId_moduleId: { roleId: adminRole.id, moduleId: mod.id } },
        update: { enabled: true, canView: true, canCreate: true, canEdit: true, canDelete: true },
        create: { 
        id: `rmp-${adminRole.id}-${mod.id}`,
        roleId: adminRole.id, 
        moduleId: mod.id, 
        enabled: true, 
        canView: true, 
        canCreate: true, 
        canEdit: true, 
        canDelete: true 
      },
      });
    }
  }

  console.log('✅ Module Management module added');
  await prisma.$disconnect();
}

run();
