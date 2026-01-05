import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma, Prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all non-system roles
    const roles = await prisma.role.findMany({
      where: {
        active: true,
        isSystemRole: false,
      },
      include: {
        modulePermissions: {
          include: { module: true },
        },
        _count: {
          select: { users: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, modulePermissions } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Role name is required' }, { status: 400 });
    }

    // Generate a unique key
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, '-');

    // Create the role
    const role = await prisma.role.create({
      data: {
        key,
        name: name.trim(),
        description: description?.trim(),
        isSystemRole: false,
      },
    });

    // Create default module permissions (disabled by default)
    const modules = await prisma.module.findMany({
      where: { active: true },
    });

    for (const appModule of modules) {
      await prisma.roleModulePermission.create({
        data: {
          roleId: role.id,
          moduleId: appModule.id,
          enabled: false,
          canView: false,
          canCreate: false,
          canEdit: false,
          canDelete: false,
        },
      });
    }

    // If modulePermissions provided, update them
    if (modulePermissions && Array.isArray(modulePermissions)) {
      for (const perm of modulePermissions) {
        if (perm.moduleId && typeof perm.enabled === 'boolean') {
          await prisma.roleModulePermission.updateMany({
            where: {
              roleId: role.id,
              moduleId: perm.moduleId,
            },
            data: {
              enabled: perm.enabled,
              canView: perm.canView ?? perm.enabled,
              canCreate: perm.canCreate ?? false,
              canEdit: perm.canEdit ?? false,
              canDelete: perm.canDelete ?? false,
            },
          });
        }
      }
    }

    return NextResponse.json(role);
  } catch (error) {
    console.error('Error creating role:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Role with this name already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create role' }, { status: 500 });
  }
}
