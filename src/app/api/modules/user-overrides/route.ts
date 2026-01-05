import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type RolePermissionSummary = {
  moduleId: string;
  enabled: boolean;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Get user's current module access (role + overrides)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roleRelation: true,
        moduleOverrides: {
          include: { module: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Resolve role record (custom or system)
    let roleRecord = user.roleRelation;
    if (!roleRecord && user.role) {
      roleRecord = await prisma.role.findUnique({
        where: { key: user.role.toLowerCase() },
      });
    }

    // Get role permissions if role exists
    let rolePermissions: RolePermissionSummary[] = [];
    if (roleRecord) {
      rolePermissions = await prisma.roleModulePermission.findMany({
        where: { roleId: roleRecord.id },
        select: {
          moduleId: true,
          enabled: true,
          canView: true,
          canCreate: true,
          canEdit: true,
          canDelete: true,
        },
      });
    }

    // Create a map of role permissions
    const rolePermsMap = new Map(
      rolePermissions.map((rp) => [rp.moduleId, rp])
    );

    // Create a map of user overrides
    const overridesMap = new Map(
      user.moduleOverrides.map((override) => [override.moduleId, override])
    );

    // Get all modules
    const modules = await prisma.module.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });

    // Merge role permissions with user overrides
    const userModuleAccess = modules.map((module) => {
      const rolePerm = rolePermsMap.get(module.id);
      const override = overridesMap.get(module.id);

      return {
        moduleId: module.id,
        moduleKey: module.key,
        moduleName: module.name,
        moduleIcon: module.icon,
        modulePath: module.path,
        // Role permissions (base)
        roleEnabled: rolePerm?.enabled ?? false,
        roleCanView: rolePerm?.canView ?? false,
        roleCanCreate: rolePerm?.canCreate ?? false,
        roleCanEdit: rolePerm?.canEdit ?? false,
        roleCanDelete: rolePerm?.canDelete ?? false,
        // User overrides (effective)
        userEnabled: override?.enabled ?? rolePerm?.enabled ?? false,
        userCanView: override?.canView ?? rolePerm?.canView ?? false,
        userCanCreate: override?.canCreate ?? rolePerm?.canCreate ?? false,
        userCanEdit: override?.canEdit ?? rolePerm?.canEdit ?? false,
        userCanDelete: override?.canDelete ?? rolePerm?.canDelete ?? false,
        // Has override
        hasOverride: !!override,
      };
    });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roleName: roleRecord?.name ?? user.role ?? 'No Role',
      },
      modules: userModuleAccess,
    });
  } catch (error) {
    console.error('Error fetching user module overrides:', error);
    return NextResponse.json({ error: 'Failed to fetch user module overrides' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { userId, moduleId, enabled, canView, canCreate, canEdit, canDelete } = body;

    if (!userId || !moduleId) {
      return NextResponse.json({ error: 'userId and moduleId are required' }, { status: 400 });
    }

    // Upsert user module permission
    const permission = await prisma.userModulePermission.upsert({
      where: {
        userId_moduleId: { userId, moduleId },
      },
      update: {
        enabled: enabled ?? false,
        canView: canView ?? false,
        canCreate: canCreate ?? false,
        canEdit: canEdit ?? false,
        canDelete: canDelete ?? false,
      },
      create: {
        userId,
        moduleId,
        enabled: enabled ?? false,
        canView: canView ?? false,
        canCreate: canCreate ?? false,
        canEdit: canEdit ?? false,
        canDelete: canDelete ?? false,
      },
    });

    return NextResponse.json(permission);
  } catch (error) {
    console.error('Error updating user module override:', error);
    return NextResponse.json({ error: 'Failed to update user module override' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const moduleId = url.searchParams.get('moduleId');

    if (!userId || !moduleId) {
      return NextResponse.json({ error: 'userId and moduleId are required' }, { status: 400 });
    }

    // Delete the user override (fall back to role permissions)
    await prisma.userModulePermission.delete({
      where: {
        userId_moduleId: { userId, moduleId },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user module override:', error);
    return NextResponse.json({ error: 'Failed to delete user module override' }, { status: 500 });
  }
}
