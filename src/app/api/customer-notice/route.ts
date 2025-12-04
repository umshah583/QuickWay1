import {NextResponse} from "next/server";
import {getAdminSettingsClient} from "@/app/admin/settings/adminSettingsClient";

export async function GET() {
  try {
    const client = getAdminSettingsClient();

    if (!client) {
      return NextResponse.json({notice: ""});
    }

    const rows = await client.findMany();
    const map = rows.reduce<Record<string, string | null>>((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});

    const raw = map["customer_notice"] ?? "";
    const notice = typeof raw === "string" ? raw : "";

    return NextResponse.json({notice});
  } catch (error) {
    console.error("Error fetching customer notice", error);
    return NextResponse.json({notice: ""}, {status: 500});
  }
}
