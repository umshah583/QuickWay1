import prisma from "@/lib/prisma";

export type AdminSettingRecord = { key: string; value: string | null };

export type AdminSettingDelegate = {
  findMany: () => Promise<AdminSettingRecord[]>;
  upsert: (args: {
    where: { key: string };
    create: AdminSettingRecord;
    update: { value: string | null };
  }) => Promise<AdminSettingRecord>;
};

export function getAdminSettingsClient(): AdminSettingDelegate | null {
  const candidate = (prisma as unknown as { adminSetting?: AdminSettingDelegate }).adminSetting;
  if (!candidate) {
    return null;
  }

  const { findMany, upsert } = candidate;
  if (typeof findMany !== "function" || typeof upsert !== "function") {
    return null;
  }

  return candidate;
}
