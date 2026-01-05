import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MODULE_DEFINITIONS = [
  { key: 'dashboard', name: 'Dashboard', description: 'Overview and analytics dashboard', icon: 'BarChart3', path: '/admin', sortOrder: 0 },
  { key: 'bookings', name: 'Bookings', description: 'Manage customer bookings and appointments', icon: 'Calendar', path: '/admin/bookings', sortOrder: 10 },
  { key: 'customers', name: 'Customers', description: 'Manage customer accounts and information', icon: 'Users', path: '/admin/customers', sortOrder: 20 },
  { key: 'services', name: 'Services', description: 'Manage available services and pricing', icon: 'Car', path: '/admin/services', sortOrder: 30 },
  { key: 'service-types', name: 'Service Types', description: 'Manage service categories and types', icon: 'Layers', path: '/admin/service-types', sortOrder: 35 },
  { key: 'drivers', name: 'Drivers', description: 'Manage driver accounts and assignments', icon: 'UserCog', path: '/admin/drivers', sortOrder: 40 },
  { key: 'driver-days', name: 'Driver Days', description: 'Track driver shifts and daily activities', icon: 'Clock', path: '/admin/driver-days', sortOrder: 45 },
  { key: 'business-day', name: 'Business Day', description: 'Manage business hours and operations', icon: 'Clock', path: '/admin/business-day', sortOrder: 50 },
  { key: 'partners', name: 'Partners', description: 'Manage partner organizations', icon: 'Building2', path: '/admin/partners', sortOrder: 55 },
  { key: 'request-approvals', name: 'Request Approvals', description: 'Approve or reject partner driver/service requests', icon: 'GitPullRequest', path: '/admin/partners/driver-requests', sortOrder: 58 },
  { key: 'transactions', name: 'Transactions', description: 'View payment transactions', icon: 'CreditCard', path: '/admin/transactions', sortOrder: 60 },
  { key: 'collections', name: 'Collections', description: 'Manage cash collections', icon: 'Wallet', path: '/admin/collections', sortOrder: 65 },
  { key: 'settlements', name: 'Settlements', description: 'Manage driver and partner settlements', icon: 'FileText', path: '/admin/settlements', sortOrder: 70 },
  { key: 'invoices', name: 'Invoices', description: 'Generate and manage invoices', icon: 'FileText', path: '/admin/invoices', sortOrder: 75 },
  { key: 'packages', name: 'Packages', description: 'Manage subscription packages', icon: 'Package', path: '/admin/packages', sortOrder: 80 },
  { key: 'subscriptions', name: 'Subscriptions', description: 'Manage customer subscriptions', icon: 'Package', path: '/admin/subscriptions', sortOrder: 85 },
  { key: 'coupons', name: 'Coupons', description: 'Create and manage discount coupons', icon: 'Tag', path: '/admin/coupons', sortOrder: 90 },
  { key: 'notifications', name: 'Notifications', description: 'Manage system notifications', icon: 'Bell', path: '/admin/notifications', sortOrder: 100 },
  { key: 'feedback', name: 'Feedback', description: 'View and manage customer feedback', icon: 'MessageSquare', path: '/admin/feedback', sortOrder: 105 },
  { key: 'user-management', name: 'User Management', description: 'Manage users and roles', icon: 'Shield', path: '/admin/user-management', sortOrder: 110 },
  { key: 'settings', name: 'Settings', description: 'System configuration and settings', icon: 'Settings', path: '/admin/settings', sortOrder: 120 },
];

const DEFAULT_ROLES = [
  { key: 'admin', name: 'Administrator', description: 'Full system access' },
  { key: 'manager', name: 'Manager', description: 'Operational management access' },
  { key: 'driver', name: 'Driver', description: 'Driver-specific access' },
  { key: 'partner', name: 'Partner', description: 'Partner organization access' },
];

async function seedModules() {
  console.log('🌱 Seeding modules...');

  // Create modules
  for (const moduleDef of MODULE_DEFINITIONS) {
    await prisma.module.upsert({
      where: { key: moduleDef.key },
      update: moduleDef,
      create: moduleDef,
    });
    console.log(`  ✓ Module: ${moduleDef.name}`);
  }

  // Create default roles
  for (const roleDef of DEFAULT_ROLES) {
    await prisma.role.upsert({
      where: { key: roleDef.key },
      update: roleDef,
      create: roleDef,
    });
    console.log(`  ✓ Role: ${roleDef.name}`);
  }

  // Get all modules and roles
  const modules = await prisma.module.findMany();
  const roles = await prisma.role.findMany();

  // Create default permissions for each role
  const adminRole = roles.find((r) => r.key === 'admin');
  const managerRole = roles.find((r) => r.key === 'manager');
  const driverRole = roles.find((r) => r.key === 'driver');
  const partnerRole = roles.find((r) => r.key === 'partner');

  // Admin gets full access to all modules
  if (adminRole) {
    for (const appModule of modules) {
      await prisma.roleModulePermission.upsert({
        where: { roleId_moduleId: { roleId: adminRole.id, moduleId: appModule.id } },
        update: { enabled: true, canView: true, canCreate: true, canEdit: true, canDelete: true },
        create: { roleId: adminRole.id, moduleId: appModule.id, enabled: true, canView: true, canCreate: true, canEdit: true, canDelete: true },
      });
    }
    console.log(`  ✓ Admin permissions set (all modules enabled)`);
  }

  // Manager gets access to operational modules
  const managerModules = ['dashboard', 'bookings', 'customers', 'services', 'drivers', 'driver-days', 'business-day', 'transactions', 'collections', 'feedback'];
  if (managerRole) {
    for (const appModule of modules) {
      const enabled = managerModules.includes(appModule.key);
      await prisma.roleModulePermission.upsert({
        where: { roleId_moduleId: { roleId: managerRole.id, moduleId: appModule.id } },
        update: { enabled, canView: enabled, canCreate: enabled, canEdit: enabled, canDelete: false },
        create: { roleId: managerRole.id, moduleId: appModule.id, enabled, canView: enabled, canCreate: enabled, canEdit: enabled, canDelete: false },
      });
    }
    console.log(`  ✓ Manager permissions set`);
  }

  // Driver gets limited access
  const driverModules = ['dashboard', 'bookings', 'driver-days'];
  if (driverRole) {
    for (const appModule of modules) {
      const enabled = driverModules.includes(appModule.key);
      await prisma.roleModulePermission.upsert({
        where: { roleId_moduleId: { roleId: driverRole.id, moduleId: appModule.id } },
        update: { enabled, canView: enabled, canCreate: false, canEdit: appModule.key === 'bookings', canDelete: false },
        create: { roleId: driverRole.id, moduleId: appModule.id, enabled, canView: enabled, canCreate: false, canEdit: appModule.key === 'bookings', canDelete: false },
      });
    }
    console.log(`  ✓ Driver permissions set`);
  }

  // Partner gets partner-specific access
  const partnerModules = ['dashboard', 'bookings', 'drivers', 'settlements'];
  if (partnerRole) {
    for (const appModule of modules) {
      const enabled = partnerModules.includes(appModule.key);
      await prisma.roleModulePermission.upsert({
        where: { roleId_moduleId: { roleId: partnerRole.id, moduleId: appModule.id } },
        update: { enabled, canView: enabled, canCreate: false, canEdit: false, canDelete: false },
        create: { roleId: partnerRole.id, moduleId: appModule.id, enabled, canView: enabled, canCreate: false, canEdit: false, canDelete: false },
      });
    }
    console.log(`  ✓ Partner permissions set`);
  }

  console.log('✅ Modules and permissions seeded successfully!');
}

seedModules()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
