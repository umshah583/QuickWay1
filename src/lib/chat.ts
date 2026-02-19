import { prisma } from '@/lib/prisma';

/**
 * Automatically creates a chat conversation when a booking is assigned to a driver
 * This should be called whenever a booking's driverId is set and status becomes ASSIGNED
 */
export async function createChatConversationForBooking(bookingId: string) {
  try {
    // Check if conversation already exists
    const existingConversation = await prisma.chatConversation.findUnique({
      where: { bookingId },
    });

    if (existingConversation) {
      console.log(`[Chat] Conversation already exists for booking ${bookingId}`);
      return existingConversation;
    }

    // Get booking with driver and customer info
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        userId: true,
        driverId: true,
        status: true,
        taskStatus: true,
        service: {
          select: { name: true },
        },
      },
    });

    if (!booking) {
      console.error(`[Chat] Booking ${bookingId} not found`);
      return null;
    }

    if (!booking.driverId) {
      console.error(`[Chat] Booking ${bookingId} has no driver assigned`);
      return null;
    }

    // Create conversation
    const conversation = await prisma.chatConversation.create({
      data: {
        bookingId: booking.id,
        customerId: booking.userId,
        driverId: booking.driverId,
      },
      include: {
        booking: {
          select: {
            id: true,
            startAt: true,
            service: {
              select: { name: true },
            },
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // Create system message (using CUSTOMER as sender since it's the booking owner)
    await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        senderId: booking.userId,
        senderType: 'CUSTOMER',
        message: `Chat conversation started for ${conversation.booking.service.name} service`,
        messageType: 'SYSTEM',
      },
    });

    console.log(`[Chat] Created conversation ${conversation.id} for booking ${bookingId}`);
    return conversation;
  } catch (error) {
    console.error(`[Chat] Failed to create conversation for booking ${bookingId}:`, error);
    return null;
  }
}
