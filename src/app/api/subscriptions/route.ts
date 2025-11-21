import { z } from "zod";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import prisma from "@/lib/prisma";
import stripeClient from "@/lib/stripe";

type MonthlyPackage = {
  id: string;
  name: string;
  priceCents: number;
  status: string;
  duration: string;
  washesPerMonth: number;
};

type PackageSubscription = {
  id: string;
  userId: string;
  packageId: string;
  status: string;
};

type PrismaWithPackages = typeof prisma & {
  monthlyPackage: {
    findUnique: (args: unknown) => Promise<MonthlyPackage | null>;
  };
  packageSubscription: {
    create: (args: unknown) => Promise<PackageSubscription>;
  };
};

const packagesDb = prisma as PrismaWithPackages;

const requestSchema = z.object({
  packageId: z.string().min(1, "Select a package"),
  paymentIntentId: z.string().min(1, "Missing payment reference"),
  scheduleDates: z.array(z.string().trim().min(1)).nonempty("Select at least one wash day"),
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

  const { packageId, paymentIntentId, scheduleDates } = parsed.data;

  const pkg = await packagesDb.monthlyPackage.findUnique({ where: { id: packageId } });
  if (!pkg || pkg.status !== "ACTIVE") {
    return errorResponse("Invalid package", 400);
  }

  // Verify payment intent
  const intent = await stripeClient.paymentIntents.retrieve(paymentIntentId);
  if (intent.status !== "succeeded") {
    return errorResponse("Payment not completed", 400);
  }

  const amountPaid = intent.amount ?? pkg.priceCents;

  const startDate = new Date();
  const endDate = new Date(startDate);
  switch (pkg.duration) {
    case "QUARTERLY":
      endDate.setMonth(endDate.getMonth() + 3);
      break;
    case "YEARLY":
      endDate.setMonth(endDate.getMonth() + 12);
      break;
    default:
      endDate.setMonth(endDate.getMonth() + 1);
  }

  const subscription = await packagesDb.packageSubscription.create({
    data: {
      userId: user.sub,
      packageId: pkg.id,
      status: "ACTIVE",
      startDate,
      endDate,
      washesRemaining: pkg.washesPerMonth,
      pricePaidCents: amountPaid,
      paymentId: intent.id,
      preferredWashDates: scheduleDates,
    },
  });

  return jsonResponse({ id: subscription.id }, { status: 201 });
}
