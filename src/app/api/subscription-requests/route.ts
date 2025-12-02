/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { calculateDiscountedPrice } from "@/lib/pricing";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

type PrismaWithRequests = typeof prisma & {
  monthlyPackage: {
    findUnique: (args: unknown) => Promise<any>;
  };
  subscriptionRequest: {
    create: (args: unknown) => Promise<any>;
    findMany: (args: unknown) => Promise<any[]>;
  };
};

const requestsDb = prisma as PrismaWithRequests;

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

const createRequestSchema = z.object({
  userId: z.string().min(1),
  packageId: z.string().min(1),
  scheduleDates: z.array(z.string()).min(1), // YYYY-MM-DD dates
  vehicleMake: z.string().optional(),
  vehicleModel: z.string().optional(),
  vehicleColor: z.string().optional(),
  vehicleType: z.string().optional(),
  vehiclePlate: z.string().optional(),
  locationLabel: z.string().optional(),
  locationCoordinates: z.string().optional(),
});

/**
 * POST /api/subscription-requests
 * Customer applies for a subscription (pending admin approval)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createRequestSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Invalid request data", 400);
    }

    const {
      userId,
      packageId,
      scheduleDates,
      vehicleMake,
      vehicleModel,
      vehicleColor,
      vehicleType,
      vehiclePlate,
      locationLabel,
      locationCoordinates,
    } = parsed.data;

    // Validate package exists and is active
    const pkg = await requestsDb.monthlyPackage.findUnique({
      where: { id: packageId },
    });

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

    // Create subscription request
    const request = await requestsDb.subscriptionRequest.create({
      data: {
        userId,
        packageId,
        scheduleDates,
        vehicleMake,
        vehicleModel,
        vehicleColor,
        vehicleType,
        vehiclePlate,
        locationLabel,
        locationCoordinates,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      success: true,
      requestId: request.id,
      status: "PENDING",
      message: "Your subscription request has been submitted for admin approval.",
    });
  } catch (error) {
    console.error("Error creating subscription request:", error);
    return errorResponse("Failed to create request", 500);
  }
}

/**
 * GET /api/subscription-requests?userId=xxx
 * Get subscription requests for a user
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return errorResponse("userId is required", 400);
    }

    const requests = await requestsDb.subscriptionRequest.findMany({
      where: { userId },
      include: {
        package: {
          select: {
            id: true,
            name: true,
            description: true,
            priceCents: true,
            washesPerMonth: true,
            discountPercent: true,
            duration: true,
            features: true,
            popular: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const enrichedRequests = requests.map((request) => {
      const discountPercent = request.package.discountPercent ?? 0;
      const discountedPriceCents = calculateDiscountedPrice(request.package.priceCents, discountPercent);

      return {
        ...request,
        package: {
          ...request.package,
          discountPercent,
          discountedPriceCents,
          discountedPriceFormatted: formatCurrency(discountedPriceCents),
          priceFormatted: formatCurrency(request.package.priceCents),
        },
      };
    });

    return NextResponse.json({ requests: enrichedRequests });
  } catch (error) {
    console.error("Error fetching subscription requests:", error);
    return errorResponse("Failed to fetch requests", 500);
  }
}
