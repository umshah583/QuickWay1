import { z } from "zod";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import prisma from "@/lib/prisma";
import stripeClient from "@/lib/stripe";

const requestSchema = z.object({
  serviceId: z.string().min(1, "Select a service"),
  amountCents: z.number().int().positive().optional(),
  currency: z.string().trim().min(3).max(10).optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export async function OPTIONS() {
  return noContentResponse("POST,OPTIONS");
}

export async function POST(req: Request) {
  if (!stripeClient) {
    return errorResponse("Stripe not configured", 500);
  }

  const user = await getMobileUserFromRequest(req);
  if (!user) {
    return errorResponse("Unauthorized", 401);
  }

  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return errorResponse(message, 400);
  }

  const { serviceId, amountCents: amountOverride, currency: currencyInput, metadata } = parsed.data;
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || !service.active) {
    return errorResponse("Invalid service", 400);
  }

  const amountCents = amountOverride ?? service.priceCents;
  if (amountCents <= 0) {
    return errorResponse("Service price is not payable", 400);
  }

  const currency = (currencyInput ?? "aed").toLowerCase();

  const intentMetadata: Record<string, string> = {
    userId: user.sub,
    serviceId: service.id,
    serviceName: service.name,
  };
  if (metadata) {
    for (const [key, value] of Object.entries(metadata)) {
      intentMetadata[key] = String(value);
    }
  }

  const intent = await stripeClient.paymentIntents.create({
    amount: amountCents,
    currency,
    automatic_payment_methods: { enabled: true },
    metadata: intentMetadata,
  });

  if (!intent.client_secret) {
    return errorResponse("Unable to create payment intent", 500);
  }

  return jsonResponse({
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
    amountCents,
  });
}
