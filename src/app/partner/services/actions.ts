"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePartnerSession } from "@/lib/partner-auth";
import { prisma } from "@/lib/prisma";
import { PARTNER_SERVICE_CAR_TYPES } from "./carTypes";

const serviceSchema = z.object({
  name: z.string().trim().min(2, "Service name is required"),
  description: z
    .string()
    .trim()
    .max(500, "Description is too long")
    .optional(),
  durationMin: z
    .string()
    .trim()
    .transform((raw) => Number.parseInt(raw, 10))
    .refine((value) => Number.isFinite(value) && value > 0, {
      message: "Duration must be a positive number of minutes",
    }),
  price: z
    .string()
    .trim()
    .transform((raw) => Number.parseFloat(raw.replace(/,/g, ".")))
    .refine((value) => Number.isFinite(value) && value > 0, {
      message: "Price must be greater than 0",
    }),
  carType: z.enum(PARTNER_SERVICE_CAR_TYPES),
  imageUrl: z.string().trim().optional(),
});

export async function createPartnerService(formData: FormData) {
  const session = await requirePartnerSession();
  const partnerUserId = session.user?.id;

  if (!partnerUserId) {
    redirect("/partner/services?error=Unable%20to%20verify%20partner%20session");
  }

  const partner = await prisma.partner.findUnique({
    where: { userId: partnerUserId },
    select: { id: true, name: true },
  });

  if (!partner) {
    redirect("/partner/services?error=Partner%20profile%20not%20found");
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = serviceSchema.safeParse(raw);

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Invalid input";
    const params = new URLSearchParams({ error: firstError });
    redirect(`/partner/services?${params.toString()}`);
  }

  const { name, description, durationMin, price, carType, imageUrl } = parsed.data;
  const priceCents = Math.round(price * 100);

  await prisma.partnerServiceRequest.create({
    data: {
      partnerId: partner!.id,
      name,
      description: description && description.length ? description : null,
      imageUrl: imageUrl && imageUrl.length ? imageUrl : null,
      durationMin,
      priceCents,
      carType,
      status: "PENDING",
    },
  });

  revalidatePath("/partner");
  revalidatePath("/partner/services");
  revalidatePath("/admin/partners");

  redirect("/partner/services?serviceRequest=1");
}
