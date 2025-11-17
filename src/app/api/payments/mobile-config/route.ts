import { jsonResponse, errorResponse, noContentResponse } from "@/lib/api-response";
import { getMobileUserFromRequest } from "@/lib/mobile-session";

export async function OPTIONS() {
  return noContentResponse("GET,OPTIONS");
}

export async function GET(req: Request) {
  const user = await getMobileUserFromRequest(req);
  if (!user) {
    return errorResponse("Unauthorized", 401);
  }

  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) {
    return errorResponse("Stripe not configured", 500);
  }

  return jsonResponse({ publishableKey });
}
