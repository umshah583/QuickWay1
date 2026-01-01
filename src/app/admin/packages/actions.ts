"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

type PackageDuration = "MONTHLY" | "QUARTERLY" | "YEARLY";
type PackageStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export type PackageFormData = {
  name: string;
  description?: string;
  duration: PackageDuration;
  washesPerMonth: number;
  priceCents: number;
  discountPercent?: number;
  popular?: boolean;
  status: PackageStatus;
  features: string[];
  serviceTypeId?: string;
  selectedAttributes?: Record<string, string[]>; // { [attributeName]: [selectedValues] }
};

export type PackageRecord = {
  id: string;
  name: string;
  description: string | null;
  duration: string;
  washesPerMonth: number;
  priceCents: number;
  discountPercent: number | null;
  popular: boolean;
  status: string;
  features: string[];
  serviceTypeId: string | null;
  serviceType?: {
    id: string;
    name: string;
  } | null;
  selectedAttributes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ServiceTypeOption = {
  id: string;
  name: string;
  attributes: unknown;
};

type PrismaWithPackages = typeof prisma & {
  monthlyPackage: {
    create: (args: unknown) => Promise<PackageRecord>;
    update: (args: unknown) => Promise<PackageRecord>;
    findUnique: (args: unknown) => Promise<PackageRecord | null>;
  };
  serviceType: {
    findMany: (args: unknown) => Promise<ServiceTypeOption[]>;
  };
};

const db = prisma as PrismaWithPackages;

export async function getServiceTypes(): Promise<ServiceTypeOption[]> {
  return db.serviceType.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      attributes: true,
    },
  });
}

export async function getPackageById(id: string): Promise<PackageRecord | null> {
  return db.monthlyPackage.findUnique({
    where: { id },
    include: {
      serviceType: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function createPackage(data: PackageFormData): Promise<{ success: boolean; error?: string }> {
  try {
    await db.monthlyPackage.create({
      data: {
        name: data.name,
        description: data.description || null,
        duration: data.duration,
        washesPerMonth: data.washesPerMonth,
        priceCents: data.priceCents,
        discountPercent: data.discountPercent || 0,
        popular: data.popular || false,
        status: data.status,
        features: data.features.filter(f => f.trim()),
        serviceTypeId: data.serviceTypeId || null,
        selectedAttributes: data.selectedAttributes ? JSON.stringify(data.selectedAttributes) : null,
        serviceIds: [],
      },
    });

    revalidatePath("/admin/packages");
    return { success: true };
  } catch (error) {
    console.error("Error creating package:", error);
    return { success: false, error: "Failed to create package" };
  }
}

export async function updatePackage(id: string, data: PackageFormData): Promise<{ success: boolean; error?: string }> {
  try {
    await db.monthlyPackage.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description || null,
        duration: data.duration,
        washesPerMonth: data.washesPerMonth,
        priceCents: data.priceCents,
        discountPercent: data.discountPercent || 0,
        popular: data.popular || false,
        status: data.status,
        features: data.features.filter(f => f.trim()),
        serviceTypeId: data.serviceTypeId || null,
        selectedAttributes: data.selectedAttributes ? JSON.stringify(data.selectedAttributes) : null,
      },
    });

    revalidatePath("/admin/packages");
    return { success: true };
  } catch (error) {
    console.error("Error updating package:", error);
    return { success: false, error: "Failed to update package" };
  }
}
