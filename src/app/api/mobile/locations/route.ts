import prisma from "@/lib/prisma";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { jsonResponse, errorResponse, noContentResponse } from "@/lib/api-response";
import { z } from "zod";

const createLocationSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(60),
  address: z.string().trim().min(1, "Address is required").max(256),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  isDefault: z.boolean().optional(),
});

export async function OPTIONS() {
  return noContentResponse("GET,POST,OPTIONS");
}

export async function GET(req: Request) {
  const user = await getMobileUserFromRequest(req);
  if (!user) {
    return errorResponse("Unauthorized", 401);
  }

  const locations = await prisma.userLocation.findMany({
    where: { userId: user.sub },
    orderBy: { createdAt: "asc" },
  });

  const items = locations.map((loc) => ({
    id: loc.id,
    label: loc.label,
    address: loc.address,
    latitude: loc.latitude,
    longitude: loc.longitude,
    isDefault: loc.isDefault,
  }));

  return jsonResponse({ items });
}

export async function POST(req: Request) {
  const user = await getMobileUserFromRequest(req);
  if (!user) {
    return errorResponse("Unauthorized", 401);
  }

  const body = await req.json().catch(() => null);
  const parsed = createLocationSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return errorResponse(message, 400);
  }

  const { label, address, latitude, longitude } = parsed.data;
  let { isDefault } = parsed.data;

  const existingCount = await prisma.userLocation.count({
    where: { userId: user.sub },
  });

  // If this is the first saved location, make it default automatically
  if (existingCount === 0) {
    isDefault = true;
  }

  if (isDefault) {
    await prisma.userLocation.updateMany({
      where: { userId: user.sub, isDefault: true },
      data: { isDefault: false },
    });
  }

  const created = await prisma.userLocation.create({
    data: {
      userId: user.sub,
      label,
      address,
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
      isDefault: Boolean(isDefault),
    },
  });

  const item = {
    id: created.id,
    label: created.label,
    address: created.address,
    latitude: created.latitude,
    longitude: created.longitude,
    isDefault: created.isDefault,
  };

  return jsonResponse(item, { status: 201 });
}
