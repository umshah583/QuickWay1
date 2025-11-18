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

export interface DriverDutyShift {
  startTime: string;
  endTime: string;
}

export interface DriverDutySettings {
  startTime: string | null;
  endTime: string | null;
  shifts?: DriverDutyShift[];
  weeklySchedule?: Record<string, DriverDutyShift[]>;
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

export async function getDriverDutySettings(driverId?: string): Promise<DriverDutySettings> {
  const baseKeys = ["driverDutyStartTime", "driverDutyEndTime", "driverDutyWeeklySchedule"];
  const keys = driverId
    ? [...baseKeys, ...baseKeys.map((key) => `${key}:${driverId}`)]
    : baseKeys;

  const settings = await prisma.adminSetting.findMany({
    where: {
      key: { in: keys },
    },
  });
  const map = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));

  const resolve = (key: string): string | null => {
    const perDriverKey = driverId ? `${key}:${driverId}` : null;
    const raw = (perDriverKey && map[perDriverKey]) ?? map[key];
    if (raw === undefined || raw === null || raw === "") return null;
    return raw;
  };

  // Parse weekly schedule JSON (global and per-driver override)
  const scheduleRaw = (driverId && map[`driverDutyWeeklySchedule:${driverId}`]) ?? map["driverDutyWeeklySchedule"];
  let weeklySchedule: Record<string, DriverDutyShift[]> | undefined;
  if (scheduleRaw) {
    try {
      const parsed = JSON.parse(scheduleRaw) as Record<string, DriverDutyShift[]>;
      if (parsed && typeof parsed === "object") {
        weeklySchedule = parsed;
      }
    } catch {
      // Ignore parse errors and fall back to simple window below
    }
  }

  // Determine today's key (MON, TUE, ...)
  const today = new Date();
  const dayIndex = today.getDay(); // 0=Sun
  const dayKeys = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
  const todayKey = dayKeys[dayIndex];

  const shifts = weeklySchedule?.[todayKey] ?? [];
  const derivedStart = shifts.length > 0 ? shifts[0]?.startTime ?? null : null;
  const derivedEnd = shifts.length > 0 ? shifts[shifts.length - 1]?.endTime ?? null : null;

  const fallbackStart = resolve("driverDutyStartTime");
  const fallbackEnd = resolve("driverDutyEndTime");

  return {
    startTime: derivedStart ?? fallbackStart,
    endTime: derivedEnd ?? fallbackEnd,
    shifts: shifts.length ? shifts : undefined,
    weeklySchedule,
  };
}

export async function setFeatureFlag(key: keyof FeatureFlags, value: boolean) {
  await prisma.adminSetting.upsert({
    where: { key },
    update: { value: value.toString() },
    create: { key, value: value.toString() },
  });
}
