/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin-auth";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

type PrismaWithRequests = typeof prisma & {
  subscriptionRequest: {
    findUnique: (args: unknown) => Promise<any>;
    update: (args: unknown) => Promise<any>;
  };
};

const requestsDb = prisma as PrismaWithRequests;

/**
 * POST /api/subscription-requests/[id]/approve
 * Admin approves a subscription request
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require admin authentication
    await requireAdminSession();

    const { id } = await params;

    // Find the request
    const request = await requestsDb.subscriptionRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return errorResponse("Request not found", 404);
    }

    if (request.status !== "PENDING") {
      return errorResponse("Request is not pending", 400);
    }

    // Update status to APPROVED
    const updatedRequest = await requestsDb.subscriptionRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Request approved. Customer can now proceed to payment.",
      request: updatedRequest,
    });
  } catch (error) {
    console.error("Error approving subscription request:", error);
    return errorResponse("Failed to approve request", 500);
  }
}
