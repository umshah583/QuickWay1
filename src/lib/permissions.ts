import { prisma } from './prisma';

// Permission key format: "module.action" e.g., "booking.manage", "notification.view.all"
export class PermissionService {
  // Get all effective permissions for a user (role + overrides)
  static async getUserPermissions(userId: string): Promise<string[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        roleRelation: {
          select: {
            permissions: {
              select: {
                permission: {
                  select: { key: true }
                }
              }
            }
          }
        },
        permissionOverrides: {
          select: {
            permission: { select: { key: true } },
            granted: true
          }
        }
      }
    });

    if (!user) return [];

    // Start with role permissions
    let permissions: string[] = user.roleRelation?.permissions.map(rp => rp.permission.key) || [];

    // Apply user overrides
    for (const override of user.permissionOverrides) {
      if (override.granted) {
        permissions.push(override.permission.key);
      } else {
        permissions = permissions.filter(p => p !== override.permission.key);
      }
    }

    return [...new Set(permissions)]; // Remove duplicates
  }

  // Check if user has specific permission
  static async hasPermission(userId: string, permissionKey: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.includes(permissionKey);
  }

  // Check if user has any of the permissions
  static async hasAnyPermission(userId: string, permissionKeys: string[]): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissionKeys.some(key => permissions.includes(key));
  }

  // Get users who have specific permission
  static async getUsersWithPermission(permissionKey: string): Promise<string[]> {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          {
            roleRelation: {
              permissions: {
                some: {
                  permission: { key: permissionKey }
                }
              }
            }
          },
          {
            permissionOverrides: {
              some: {
                permission: { key: permissionKey },
                granted: true
              }
            }
          }
        ]
      },
      select: { id: true }
    });

    return users.map(u => u.id);
  }
}
