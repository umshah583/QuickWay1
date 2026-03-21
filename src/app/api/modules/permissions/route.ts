import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all roles with their module permissions
    const roles = await prisma.role.findMany({
      where: { active: true },
      include: {
        RolePermission: {
          include: { Permission: true },
        },
      },
      orderBy: { key: 'asc' },
    });

    // Get all modules
    const modules = await prisma.module.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });

    // Build permission matrix
    const permissionMatrix = roles.map((role) => ({
      roleId: role.id,
      roleKey: role.key,
      roleName: role.name,
      modules: modules.map((module) => {
        const permission = role.RolePermission.find((mp) => mp.Permission.module === module.key);
        return {
          moduleId: module.id,
          moduleKey: module.key,
          moduleName: module.name,
          moduleIcon: module.icon,
          modulePath: module.path,
          enabled: !!permission,
          canView: !!permission,
          canCreate: !!permission,
          canEdit: !!permission,
          canDelete: !!permission,
        };
      }),
    }));

    return NextResponse.json(permissionMatrix);
  } catch (error) {
    console.error('Error fetching module permissions:', error);
    return NextResponse.json({ error: 'Failed to fetch module permissions' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { roleId, moduleId, enabled, canView, canCreate, canEdit, canDelete } = body;

    if (!roleId || !moduleId) {
      return NextResponse.json({ error: 'roleId and moduleId are required' }, { status: 400 });
    }

    // Upsert permission
    const permission = await prisma.roleModulePermission.upsert({
      where: { roleId_moduleId: { roleId, moduleId } },
      update: {
        enabled: enabled ?? false,
        canView: canView ?? false,
        canCreate: canCreate ?? false,
        canEdit: canEdit ?? false,
        canDelete: canDelete ?? false,
      },
      create: {
        roleId,
        moduleId,
        enabled: enabled ?? false,
        canView: canView ?? false,
        canCreate: canCreate ?? false,
        canEdit: canEdit ?? false,
        canDelete: canDelete ?? false,
      } as any,
    });

    return NextResponse.json(permission);
  } catch (error) {
    console.error('Error updating module permission:', error);
    return NextResponse.json({ error: 'Failed to update module permission' }, { status: 500 });
  }
}
