import { jsonResponse } from "@/lib/api-response";

export async function POST(req: Request) {
  // For JWT tokens, logout is handled client-side by deleting the token
  // Server doesn't need to do anything since we're using stateless JWT
  return jsonResponse({ success: true, message: "Logged out successfully" });
}
