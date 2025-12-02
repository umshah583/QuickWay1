import { z } from "zod";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import prisma from "@/lib/prisma";
import stripeClient from "@/lib/stripe";
import { calculateDiscountedPrice } from "@/lib/pricing";

type MonthlyPackage = {
  id: string;
  name: string;
  priceCents: number;
  status: string;
  discountPercent: number | null;
};

type PrismaWithPackages = typeof prisma & {
  monthlyPackage: {
    findUnique: (args: unknown) => Promise<MonthlyPackage | null>;
  };
};

const packagesDb = prisma as PrismaWithPackages;

const requestSchema = z.object({
  packageId: z.string().min(1, "Select a package"),
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

  const { packageId, amountCents: amountOverride, currency: currencyInput, metadata } = parsed.data;

  const pkg = await packagesDb.monthlyPackage.findUnique({ where: { id: packageId } });
  if (!pkg || pkg.status !== "ACTIVE") {
    return errorResponse("Invalid package", 400);
  }

  const discountedPriceCents = calculateDiscountedPrice(pkg.priceCents, pkg.discountPercent ?? 0);
  const amountCents = amountOverride ?? discountedPriceCents;
  if (amountCents <= 0) {
    return errorResponse("Package price is not payable", 400);
  }

  const currency = (currencyInput ?? "aed").toLowerCase();

  const intentMetadata: Record<string, string> = {
    userId: user.sub,
    packageId: pkg.id,
    packageName: pkg.name,
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
