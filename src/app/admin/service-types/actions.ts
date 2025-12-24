"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createServiceType(formData: FormData) {
  const name = formData.get("name") as string;
  const description = formData.get("description") as string | null;
  const icon = formData.get("icon") as string | null;
  const color = formData.get("color") as string | null;
  const active = formData.get("active") === "on";
  const sortOrder = parseInt(formData.get("sortOrder") as string) || 0;
  const attributesJson = formData.get("attributes") as string | null;
  const attributes = attributesJson ? JSON.parse(attributesJson) : null;

  await prisma.serviceType.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      icon: icon?.trim() || null,
      color: color?.trim() || null,
      active,
      sortOrder,
      attributes,
    },
  });

  revalidatePath("/admin/service-types");
  revalidatePath("/admin/services");
}

export async function updateServiceType(formData: FormData) {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const description = formData.get("description") as string | null;
  const icon = formData.get("icon") as string | null;
  const color = formData.get("color") as string | null;
  const active = formData.get("active") === "on";
  const sortOrder = parseInt(formData.get("sortOrder") as string) || 0;
  const attributesJson = formData.get("attributes") as string | null;
  const attributes = attributesJson ? JSON.parse(attributesJson) : null;

  await prisma.serviceType.update({
    where: { id },
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      icon: icon?.trim() || null,
      color: color?.trim() || null,
      active,
      sortOrder,
      attributes,
    },
  });

  revalidatePath("/admin/service-types");
  revalidatePath("/admin/services");
}

export async function deleteServiceType(id: string) {
  // Check if any services are using this type
  const servicesCount = await prisma.service.count({
    where: { serviceTypeId: id },
  });

  if (servicesCount > 0) {
    throw new Error(`Cannot delete: ${servicesCount} services are using this type`);
  }

  await prisma.serviceType.delete({
    where: { id },
  });

  revalidatePath("/admin/service-types");
  revalidatePath("/admin/services");
}
