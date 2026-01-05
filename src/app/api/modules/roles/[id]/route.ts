import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: roleId } = await context.params;

    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, modulePermissions } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Role name is required' }, { status: 400 });
    }

    // Update the role
    const role = await prisma.role.update({
      where: { id: roleId },
      data: {
        name: name.trim(),
        description: description?.trim(),
      },
    });

    // Delete existing permissions and create new ones
    await prisma.roleModulePermission.deleteMany({
      where: { roleId },
    });

    // Create new permissions
    if (modulePermissions && Array.isArray(modulePermissions)) {
      for (const perm of modulePermissions) {
        if (perm.moduleId && typeof perm.enabled === 'boolean') {
          await prisma.roleModulePermission.create({
            data: {
              roleId,
              moduleId: perm.moduleId,
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
    console.error('Error updating role:', error);
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: roleId } = await context.params;

    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if role has users assigned
    const userCount = await prisma.user.count({
      where: { roleId },
    });

    if (userCount > 0) {
      return NextResponse.json({ error: 'Cannot delete role that has users assigned' }, { status: 400 });
    }

    // Delete role permissions first
    await prisma.roleModulePermission.deleteMany({
      where: { roleId },
    });

    // Delete the role
    await prisma.role.delete({
      where: { id: roleId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting role:', error);
    return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 });
  }
}
