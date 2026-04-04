// Driver Spot Order Update API Endpoint
// PUT /api/driver/spot-orders/[id] - Update spot order status

import { NextRequest, NextResponse } from 'next/server';
import { getMobileUserFromRequest } from '@/lib/mobile-session';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { errorResponse, jsonResponse } from '@/lib/api-response';

// Request schema for updating spot order
const UpdateSpotOrderSchema = z.object({
  status: z.enum(['ACCEPTED', 'IN_PROGRESS', 'COMPLETED']),
  driverNotes: z.string().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate driver
    const session = await getMobileUserFromRequest(request);
    if (!session || session.role !== 'DRIVER') {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    // Parse and validate request body
    const body = await request.json();
    const validation = UpdateSpotOrderSchema.safeParse(body);
    
    if (!validation.success) {
      return jsonResponse(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { status, driverNotes } = validation.data;

    // Find the spot order and verify it belongs to this driver
    const existingOrder = await prisma.spotOrder.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      return errorResponse('Spot order not found', 404);
    }

    if (existingOrder.driverId !== session.sub) {
      return errorResponse('Unauthorized to update this spot order', 403);
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      'PENDING': ['ACCEPTED'],
      'ACCEPTED': ['IN_PROGRESS'],
      'IN_PROGRESS': ['COMPLETED'],
      'COMPLETED': [], // No further transitions allowed
    };

    if (!validTransitions[existingOrder.status].includes(status)) {
      return jsonResponse(
        { 
          error: 'Invalid status transition', 
          currentStatus: existingOrder.status,
          requestedStatus: status,
          allowedTransitions: validTransitions[existingOrder.status]
        },
        { status: 400 }
      );
    }

    // Update the spot order
    const updateData: any = {
      status,
    };

    // Add timestamps based on status
    if (status === 'ACCEPTED') {
      updateData.acceptedAt = new Date();
    } else if (status === 'COMPLETED') {
      updateData.completedAt = new Date();
    }

    // Add driver notes if provided
    if (driverNotes !== undefined) {
      updateData.driverNotes = driverNotes;
    }

    const updatedOrder = await prisma.spotOrder.update({
      where: { id },
      data: updateData,
      include: {
        Area: {
          select: {
            id: true,
            name: true,
            description: true,
            active: true,
          },
        },
        Service: {
          select: {
            id: true,
            name: true,
            priceCents: true,
          },
        },
      },
    });

    return jsonResponse(updatedOrder);

  } catch (error) {
    console.error('Error in driver spot order PUT API:', error);
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return errorResponse('Unauthorized', 401);
    }

    return errorResponse('Internal server error', 500);
  }
}
