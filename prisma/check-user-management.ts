import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const appModule = await prisma.module.findUnique({ where: { key: 'user-management' } });
  const adminRole = await prisma.role.findUnique({ where: { key: 'admin' } });
  let perm = null;
  if (appModule && adminRole) {
    perm = await prisma.roleModulePermission.findUnique({
      where: {
        roleId_moduleId: {
          roleId: adminRole.id,
          moduleId: appModule.id,
        },
      },
    });
  }
  console.log({ appModule, adminRole, perm });
  await prisma.$disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
