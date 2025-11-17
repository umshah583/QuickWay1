import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { computeLoyaltySummary } from "@/lib/loyalty";

export function OPTIONS() {
  return noContentResponse("GET,OPTIONS");
}

export async function GET(req: Request) {
  const mobileUser = await getMobileUserFromRequest(req);
  let userId: string | null = null;

  if (mobileUser) {
    userId = mobileUser.sub;
  } else {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse("Unauthorized", 401);
    }
    userId = (session.user as { id?: string }).id ?? null;
  }

  if (!userId) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const summary = await computeLoyaltySummary(userId);
    return jsonResponse(summary);
  } catch (error: unknown) {
    console.error("[loyalty/summary]", error);
    return errorResponse("Unable to load loyalty summary", 500);
  }
}
