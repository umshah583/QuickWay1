"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePartnerSession } from "@/lib/partner-auth";
import { prisma } from "@/lib/prisma";
import { PARTNER_SERVICE_CAR_TYPES } from "./carTypes";

type ServiceTypeAttribute = {
  name: string;
  type: "text" | "select" | "checkbox";
  options?: string[];
  required?: boolean;
};

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
  serviceTypeId: z.string().trim().min(1, "Service type is required"),
  carType: z.string().trim().min(1, "Please select at least one vehicle/type"),
  attributeValues: z.string().optional(),
  imageUrl: z.string().trim().optional(),
});

function parseAttributeValues(raw?: string | null): Record<string, string | string[]> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string | string[]>;
    }
  } catch {
    // fallthrough
  }
  throw new Error("Invalid attribute data submitted. Please refresh and try again.");
}

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

  const {
    name,
    description,
    durationMin,
    price,
    carType,
    imageUrl,
    serviceTypeId,
    attributeValues: attributeValuesJson,
  } = parsed.data;
  const priceCents = Math.round(price * 100);
  const parsedAttributeValues = parseAttributeValues(attributeValuesJson);

  const serviceType = await prisma.serviceType.findUnique({
    where: { id: serviceTypeId },
    select: {
      id: true,
      name: true,
      attributes: true,
      active: true,
    },
  });

  if (!serviceType || serviceType.active === false) {
    redirect("/partner/services?error=Selected%20service%20type%20is%20not%20available");
  }

  const attributes = (serviceType.attributes as ServiceTypeAttribute[] | null) ?? [];
  const primaryAttribute = attributes.find(
    (attr) => attr.type === "checkbox" && attr.options && attr.options.length > 0,
  );

  if (primaryAttribute?.options?.length) {
    if (!primaryAttribute.options.includes(carType)) {
      redirect(
        `/partner/services?error=${encodeURIComponent(
          `Please select a valid ${primaryAttribute.name} option`,
        )}`,
      );
    }
  } else if (!PARTNER_SERVICE_CAR_TYPES.includes(carType as (typeof PARTNER_SERVICE_CAR_TYPES)[number])) {
    redirect("/partner/services?error=Please%20select%20a%20valid%20vehicle%20type");
  }

  const normalizedAttributeValues: Record<string, string | string[]> = {};

  attributes.forEach((attr) => {
    if (attr === primaryAttribute) {
      normalizedAttributeValues[attr.name] = carType;
      return;
    }

    const submittedValue = parsedAttributeValues[attr.name];

    if (attr.type === "checkbox") {
      const submittedArray = Array.isArray(submittedValue)
        ? submittedValue
        : typeof submittedValue === "string"
          ? [submittedValue]
          : [];
      const filtered = submittedArray.filter((value) => attr.options?.includes(value));
      if (attr.required && filtered.length === 0) {
        throw new Error(`Please select at least one option for ${attr.name}`);
      }
      if (filtered.length > 0) {
        normalizedAttributeValues[attr.name] = filtered;
      }
      return;
    }

    if (attr.type === "select") {
      const value = typeof submittedValue === "string" ? submittedValue : "";
      if (attr.required && !value) {
        throw new Error(`Please select a value for ${attr.name}`);
      }
      if (value && attr.options?.includes(value)) {
        normalizedAttributeValues[attr.name] = value;
      }
      return;
    }

    if (attr.type === "text") {
      const value = typeof submittedValue === "string" ? submittedValue.trim() : "";
      if (attr.required && !value) {
        throw new Error(`Please enter a value for ${attr.name}`);
      }
      if (value) {
        normalizedAttributeValues[attr.name] = value;
      }
      return;
    }
  });

  await prisma.partnerServiceRequest.create({
    data: {
      partnerId: partner!.id,
      name,
      description: description && description.length ? description : null,
      imageUrl: imageUrl && imageUrl.length ? imageUrl : null,
      durationMin,
      priceCents,
      carType,
      serviceTypeId,
      attributeValues: Object.keys(normalizedAttributeValues).length ? normalizedAttributeValues : null,
      status: "PENDING",
    },
  });

  revalidatePath("/partner");
  revalidatePath("/partner/services");
  revalidatePath("/admin/partners");

  redirect("/partner/services?serviceRequest=1");
}
