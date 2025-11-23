import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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

const rejectSchema = z.object({
  rejectionReason: z.string().min(1, "Rejection reason is required"),
});

/**
 * POST /api/subscription-requests/[id]/reject
 * Admin rejects a subscription request with reason
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Require admin authentication
    await requireAdminSession();

    const { id } = params;
    const body = await req.json();
    const parsed = rejectSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Rejection reason is required", 400);
    }

    const { rejectionReason } = parsed.data;

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

    // Update status to REJECTED
    const updatedRequest = await requestsDb.subscriptionRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectionReason,
        rejectedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Request rejected.",
      request: updatedRequest,
    });
  } catch (error) {
    console.error("Error rejecting subscription request:", error);
    return errorResponse("Failed to reject request", 500);
  }
}
