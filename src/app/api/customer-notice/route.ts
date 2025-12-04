import {NextResponse} from "next/server";
import {getAdminSettingsClient} from "@/app/admin/settings/adminSettingsClient";

export async function GET() {
  try {
    const client = getAdminSettingsClient();

    if (!client) {
      return NextResponse.json({ notice: "", backgroundColor: null, textColor: null, fontWeight: null });
    }

    const rows = await client.findMany();
    const map = rows.reduce<Record<string, string | null>>((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});

    const rawNotice = map["customer_notice"] ?? "";
    const notice = typeof rawNotice === "string" ? rawNotice : "";

    const rawBg = map["customer_notice_bg"] ?? null;
    const rawTextColor = map["customer_notice_text_color"] ?? null;
    const rawFontWeight = map["customer_notice_font_weight"] ?? null;

    const backgroundColor = typeof rawBg === "string" && rawBg.trim() !== "" ? rawBg.trim() : null;
    const textColor = typeof rawTextColor === "string" && rawTextColor.trim() !== "" ? rawTextColor.trim() : null;
    const fontWeight = typeof rawFontWeight === "string" && rawFontWeight.trim() !== ""
      ? rawFontWeight.trim()
      : null;

    return NextResponse.json({ notice, backgroundColor, textColor, fontWeight });
  } catch (error) {
    console.error("Error fetching customer notice", error);
    return NextResponse.json({ notice: "", backgroundColor: null, textColor: null, fontWeight: null }, { status: 500 });
  }
}
