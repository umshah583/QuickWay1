import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin-auth";

export async function POST() {
  try {
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if Areas module already exists
    const existingModule = await prisma.module.findFirst({
      where: { key: "areas" },
    });

    if (existingModule) {
      return NextResponse.json({ message: "Areas module already exists", module: existingModule });
    }

    // Get the max sort order to add this at the end
    const maxSortOrder = await prisma.module.aggregate({
      _max: { sortOrder: true },
    });

    const newSortOrder = (maxSortOrder._max.sortOrder ?? 0) + 1;

    // Create the Areas module
    const areasModule = await prisma.module.create({
      data: {
        key: "areas",
        name: "Service Areas",
        description: "Manage geographic zones for location-based pricing",
        icon: "MapPin",
        path: "/admin/areas",
        sortOrder: newSortOrder,
        active: true,
      },
    });

    // Grant full permissions to admin role
    const adminRole = await prisma.role.findFirst({
      where: { key: "admin" },
    });

    if (adminRole) {
      await prisma.roleModulePermission.create({
        data: {
          roleId: adminRole.id,
          moduleId: areasModule.id,
          enabled: true,
          canView: true,
          canCreate: true,
          canEdit: true,
          canDelete: true,
        },
      });
    }

    return NextResponse.json({ 
      message: "Areas module created successfully", 
      module: areasModule 
    });
  } catch (error) {
    console.error("[seed-areas] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to seed areas module" },
      { status: 500 }
    );
  }
}
