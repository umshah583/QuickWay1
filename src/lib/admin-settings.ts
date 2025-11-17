import prisma from "./prisma";

export interface FeatureFlags {
  enableCoupons: boolean;
  enableLoyalty: boolean;
  driverTabOverview: boolean;
  driverTabAssignments: boolean;
  driverTabCash: boolean;
  partnerTabAssignments: boolean;
  partnerTabDrivers: boolean;
  partnerTabEarnings: boolean;
}

export async function getFeatureFlags(): Promise<FeatureFlags> {
  const settings = await prisma.adminSetting.findMany();
  const map = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));

  const bool = (key: string, fallback: boolean) => {
    const raw = map[key];
    if (raw === undefined || raw === null) return fallback;
    return raw === "true";
  };

  return {
    enableCoupons: bool("enableCoupons", true),
    enableLoyalty: bool("enableLoyalty", true),
    driverTabOverview: bool("driverTabOverview", true),
    driverTabAssignments: bool("driverTabAssignments", true),
    driverTabCash: bool("driverTabCash", true),
    partnerTabAssignments: bool("partnerTabAssignments", true),
    partnerTabDrivers: bool("partnerTabDrivers", true),
    partnerTabEarnings: bool("partnerTabEarnings", true),
  };
}

export async function setFeatureFlag(key: keyof FeatureFlags, value: boolean) {
  await prisma.adminSetting.upsert({
    where: { key },
    update: { value: value.toString() },
    create: { key, value: value.toString() },
  });
}
