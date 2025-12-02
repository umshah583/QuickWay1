import { NextResponse } from "next/server";
import { getAdminSettingsClient } from "@/app/admin/settings/adminSettingsClient";
import {
  FEATURED_PROMOTIONS_SETTING_KEY,
  parseFeaturedPromotionsSetting,
} from "@/app/admin/settings/pricingConstants";

export async function GET() {
  try {
    const client = getAdminSettingsClient();

    if (!client) {
      return NextResponse.json({ items: [] });
    }

    const rows = await client.findMany();
    const map = rows.reduce<Record<string, string | null>>((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});

    const raw = map[FEATURED_PROMOTIONS_SETTING_KEY] ?? null;
    const featuredPromotions = parseFeaturedPromotionsSetting(raw);

    return NextResponse.json({ items: featuredPromotions });
  } catch (error) {
    console.error("Error fetching featured promotions", error);
    return NextResponse.json({ items: [] }, { status: 500 });
  }
}
