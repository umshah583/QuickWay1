import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminSettingsClient } from "@/app/admin/settings/adminSettingsClient";
import {
  FEATURED_PROMOTIONS_SETTING_KEY,
  parseFeaturedPromotionsSetting,
  type FeaturedPromotionSetting,
} from "@/app/admin/settings/pricingConstants";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

async function loadPromotions(): Promise<FeaturedPromotionSetting[]> {
  const client = getAdminSettingsClient();
  if (!client) return [];

  const rows = await client.findMany();
  const map = rows.reduce<Record<string, string | null>>((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});

  const raw = map[FEATURED_PROMOTIONS_SETTING_KEY] ?? null;
  return parseFeaturedPromotionsSetting(raw);
}

async function savePromotions(items: FeaturedPromotionSetting[]): Promise<void> {
  const client = getAdminSettingsClient();
  if (!client) return;

  const value = items.length ? JSON.stringify(items) : null;

  await client.upsert({
    where: { key: FEATURED_PROMOTIONS_SETTING_KEY },
    create: { key: FEATURED_PROMOTIONS_SETTING_KEY, value },
    update: { value },
  });
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const items = await loadPromotions();
    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error fetching featured promotions (admin)", error);
    return NextResponse.json({ error: "Failed to load promotions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      title,
      description,
      savingsLabel,
      ctaLabel,
      ctaLink,
      serviceId,
      imageUrl,
      textColorScheme,
      titleColor,
      descriptionColor,
      savingsColor,
      ctaColor,
    } = body ?? {};

    if (!title || !description || !savingsLabel) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const items = await loadPromotions();

    const normalizedTextColorScheme =
      typeof textColorScheme === "string" ? textColorScheme.trim() : undefined;

    items.push({
      title: String(title).trim(),
      description: String(description).trim(),
      savingsLabel: String(savingsLabel).trim(),
      ctaLabel: ctaLabel ? String(ctaLabel).trim() : undefined,
      ctaLink: ctaLink ? String(ctaLink).trim() : undefined,
      serviceId: serviceId ? String(serviceId).trim() : undefined,
      imageUrl: imageUrl ? String(imageUrl).trim() : undefined,
      textColorScheme:
        normalizedTextColorScheme === "light" || normalizedTextColorScheme === "dark"
          ? normalizedTextColorScheme
          : undefined,
      titleColor: titleColor ? String(titleColor).trim() : undefined,
      descriptionColor: descriptionColor ? String(descriptionColor).trim() : undefined,
      savingsColor: savingsColor ? String(savingsColor).trim() : undefined,
      ctaColor: ctaColor ? String(ctaColor).trim() : undefined,
    });

    await savePromotions(items);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error creating featured promotion", error);
    return NextResponse.json({ error: "Failed to create promotion" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const index = Number(body?.index);
    const data = body?.data ?? {};

    if (!Number.isInteger(index) || index < 0) {
      return NextResponse.json({ error: "Invalid index" }, { status: 400 });
    }

    const items = await loadPromotions();
    if (index >= items.length) {
      return NextResponse.json({ error: "Promotion not found" }, { status: 404 });
    }

    const {
      title,
      description,
      savingsLabel,
      ctaLabel,
      ctaLink,
      serviceId,
      imageUrl,
      textColorScheme,
      titleColor,
      descriptionColor,
      savingsColor,
      ctaColor,
    } = data;
    if (!title || !description || !savingsLabel) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const normalizedTextColorScheme =
      typeof textColorScheme === "string" ? textColorScheme.trim() : undefined;

    items[index] = {
      title: String(title).trim(),
      description: String(description).trim(),
      savingsLabel: String(savingsLabel).trim(),
      ctaLabel: ctaLabel ? String(ctaLabel).trim() : undefined,
      ctaLink: ctaLink ? String(ctaLink).trim() : undefined,
      serviceId: serviceId ? String(serviceId).trim() : undefined,
      imageUrl: imageUrl ? String(imageUrl).trim() : undefined,
      textColorScheme:
        normalizedTextColorScheme === "light" || normalizedTextColorScheme === "dark"
          ? normalizedTextColorScheme
          : undefined,
      titleColor: titleColor ? String(titleColor).trim() : undefined,
      descriptionColor: descriptionColor ? String(descriptionColor).trim() : undefined,
      savingsColor: savingsColor ? String(savingsColor).trim() : undefined,
      ctaColor: ctaColor ? String(ctaColor).trim() : undefined,
    };

    await savePromotions(items);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error updating featured promotion", error);
    return NextResponse.json({ error: "Failed to update promotion" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const index = Number(body?.index);

    if (!Number.isInteger(index) || index < 0) {
      return NextResponse.json({ error: "Invalid index" }, { status: 400 });
    }

    const items = await loadPromotions();
    if (index >= items.length) {
      return NextResponse.json({ error: "Promotion not found" }, { status: 404 });
    }

    items.splice(index, 1);
    await savePromotions(items);

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error deleting featured promotion", error);
    return NextResponse.json({ error: "Failed to delete promotion" }, { status: 500 });
  }
}
