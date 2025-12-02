import prisma from "@/lib/prisma";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { jsonResponse, errorResponse, noContentResponse } from "@/lib/api-response";
import { z } from "zod";

const updateLocationSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(60).optional(),
  address: z.string().trim().min(1, "Address is required").max(256).optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  isDefault: z.boolean().optional(),
});

export async function OPTIONS() {
  return noContentResponse("GET,PATCH,DELETE,OPTIONS");
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getMobileUserFromRequest(req);
  if (!user) {
    return errorResponse("Unauthorized", 401);
  }

  const { id } = await params;

  const existing = await prisma.userLocation.findFirst({
    where: { id, userId: user.sub },
  });

  if (!existing) {
    return errorResponse("Location not found", 404);
  }

  const body = await req.json().catch(() => null);
  const parsed = updateLocationSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return errorResponse(message, 400);
  }

  const { label, address, latitude, longitude } = parsed.data;
  let { isDefault } = parsed.data;

  const updateData: {
    label?: string;
    address?: string;
    latitude?: number | null;
    longitude?: number | null;
    isDefault?: boolean;
  } = {};

  if (label !== undefined) updateData.label = label;
  if (address !== undefined) updateData.address = address;
  if (latitude !== undefined) updateData.latitude = latitude ?? null;
  if (longitude !== undefined) updateData.longitude = longitude ?? null;
  if (isDefault !== undefined) updateData.isDefault = Boolean(isDefault);

  if (isDefault) {
    await prisma.userLocation.updateMany({
      where: { userId: user.sub, isDefault: true },
      data: { isDefault: false },
    });
  }

  const updated = await prisma.userLocation.update({
    where: { id: existing.id },
    data: updateData,
  });

  const item = {
    id: updated.id,
    label: updated.label,
    address: updated.address,
    latitude: updated.latitude,
    longitude: updated.longitude,
    isDefault: updated.isDefault,
  };

  return jsonResponse(item);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getMobileUserFromRequest(req);
  if (!user) {
    return errorResponse("Unauthorized", 401);
  }

  const { id } = await params;

  const existing = await prisma.userLocation.findFirst({
    where: { id, userId: user.sub },
  });

  if (!existing) {
    return errorResponse("Location not found", 404);
  }

  await prisma.userLocation.delete({
    where: { id: existing.id },
  });

  return jsonResponse({ success: true });
}
