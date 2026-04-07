import { NextRequest, NextResponse } from 'next/server';
import { requireAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    const session = await requireAuthSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find a booking with a driver to create a test conversation
    const booking = await prisma.booking.findFirst({
      where: {
        driverId: { not: '' },
        userId: { not: '' },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'No suitable booking found' }, { status: 404 });
    }

    // Fetch related data separately
    const [customer, driver, service] = await Promise.all([
      prisma.user.findUnique({
        where: { id: booking.userId },
        select: { id: true, name: true, image: true },
      }),
      prisma.user.findUnique({
        where: { id: booking.driverId! },
        select: { id: true, name: true, image: true },
      }),
      prisma.service.findUnique({
        where: { id: booking.serviceId },
        select: { name: true },
      }),
    ]);

    // Check if conversation already exists
    const existingConversation = await prisma.chatConversation.findUnique({
      where: { bookingId: booking.id },
    });

    if (existingConversation) {
      return NextResponse.json({ 
        message: 'Conversation already exists',
        conversationId: existingConversation.id
      });
    }

    // Create test conversation
    const conversation = await prisma.chatConversation.create({
      data: {
        id: `chat-${booking.id}-${Date.now()}`,
        bookingId: booking.id,
        customerId: booking.userId,
        driverId: booking.driverId!,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create a system message
    await prisma.chatMessage.create({
      data: {
        id: `msg-${conversation.id}-${Date.now()}`,
        conversationId: conversation.id,
        senderId: session.user.id,
        senderType: 'CUSTOMER', // Use valid enum value
        message: `Test conversation created for ${service?.name || 'service'}`,
        messageType: 'TEXT',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log('[TestConversation] Created test conversation:', conversation.id);

    return NextResponse.json({
      message: 'Test conversation created successfully',
      conversationId: conversation.id,
      service: service?.name,
      customer: customer?.name,
      driver: driver?.name,
    });
  } catch (error) {
    console.error('[TestConversation] Error:', error);
    return NextResponse.json({ error: 'Failed to create test conversation' }, { status: 500 });
  }
}
