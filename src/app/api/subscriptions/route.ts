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

type SubscriptionWithPackage = {
  id: string;
  status: string;
  startDate: Date;
  endDate: Date;
  washesRemaining: number;
  washesUsed: number;
  pricePaidCents: number;
  preferredWashDates: string[];
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleColor?: string | null;
  vehicleType?: string | null;
  vehiclePlate?: string | null;
  locationLabel?: string | null;
  locationCoordinates?: string | null;
  package: {
    id: string;
    name: string;
    duration: string;
    washesPerMonth: number;
    priceCents: number;
  };
};

type PrismaWithPackages = typeof prisma & {
  monthlyPackage: {
    findUnique: (args: unknown) => Promise<MonthlyPackage | null>;
  };
  packageSubscription: {
    create: (args: unknown) => Promise<PackageSubscription>;
    findMany: (args: unknown) => Promise<SubscriptionWithPackage[]>;
  };
};

const packagesDb = prisma as PrismaWithPackages;

const requestSchema = z.object({
  packageId: z.string().min(1, "Select a package"),
  paymentIntentId: z.string().min(1, "Missing payment reference"),
  scheduleDates: z.array(z.string().trim().min(1)).nonempty("Select at least one wash day"),
  // Optional fixed car + location per subscription
  vehicleMake: z.string().trim().optional(),
  vehicleModel: z.string().trim().optional(),
  vehicleColor: z.string().trim().optional(),
  vehicleType: z.string().trim().optional(),
  vehiclePlate: z.string().trim().optional(),
  locationLabel: z.string().trim().optional(),
  locationCoordinates: z.string().trim().optional(),
});

export async function OPTIONS() {
  return noContentResponse("GET,POST,OPTIONS");
}

export async function GET(req: Request) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    const url = new URL(req.url ?? "http://localhost");
    const statusParam = url.searchParams.get("status");
    const statusFilter = statusParam ? statusParam.toUpperCase() : "ACTIVE";

    const where: Record<string, unknown> = {
      userId: user.sub,
    };

    if (statusFilter === "ACTIVE") {
      where.status = "ACTIVE";
    }

    const subscriptions = await packagesDb.packageSubscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        package: {
          select: {
            id: true,
            name: true,
            duration: true,
            washesPerMonth: true,
            priceCents: true,
          },
        },
      },
    });

    return jsonResponse({ data: subscriptions });
  } catch (error) {
    console.error("Error fetching subscriptions", error);
    return errorResponse("Failed to fetch subscriptions", 500);
  }
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

  const {
    packageId,
    paymentIntentId,
    scheduleDates,
    vehicleMake,
    vehicleModel,
    vehicleColor,
    vehicleType,
    vehiclePlate,
    locationLabel,
    locationCoordinates,
  } = parsed.data;

  const pkg = await packagesDb.monthlyPackage.findUnique({ where: { id: packageId } });
  if (!pkg || pkg.status !== "ACTIVE") {
    return errorResponse("Invalid package", 400);
  }

  // Validate: cannot select more days than washes included
  if (scheduleDates.length > pkg.washesPerMonth) {
    return errorResponse(
      `You selected ${scheduleDates.length} days, but this package includes only ${pkg.washesPerMonth} washes. Please select up to ${pkg.washesPerMonth} days.`,
      400
    );
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
      vehicleMake,
      vehicleModel,
      vehicleColor,
      vehicleType,
      vehiclePlate,
      locationLabel,
      locationCoordinates,
    },
  });

  return jsonResponse({ id: subscription.id }, { status: 201 });
}
