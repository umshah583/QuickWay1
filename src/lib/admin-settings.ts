import prisma from "./prisma";

export interface FeatureFlags {
  enableCoupons: boolean;
  enableLoyalty: boolean;
}

export async function getFeatureFlags(): Promise<FeatureFlags> {
  const settings = await prisma.adminSetting.findMany();
  const flags = Object.fromEntries(settings.map(s => [s.key, s.value === "true"]));

  return {
    enableCoupons: flags.enableCoupons ?? true, // default true
    enableLoyalty: flags.enableLoyalty ?? true,
  };
}

export async function setFeatureFlag(key: keyof FeatureFlags, value: boolean) {
  await prisma.adminSetting.upsert({
    where: { key },
    update: { value: value.toString() },
    create: { key, value: value.toString() },
  });
}
