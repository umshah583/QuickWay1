import { NextRequest, NextResponse } from 'next/server';
import { requireAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/chat/conversations - Get user's conversations
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession(request);

    // Get conversations for the current user (either as customer or driver)
    const conversations = await prisma.chatConversation.findMany({
      where: {
        OR: [
          { customerId: session.user.id },
          { driverId: session.user.id },
        ],
        status: 'ACTIVE',
      },
      include: {
        booking: {
          select: {
            id: true,
            startAt: true,
            service: {
              select: {
                name: true,
              },
            },
            status: true,
            taskStatus: true,
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
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          select: {
            message: true,
            senderType: true,
            createdAt: true,
            readAt: true,
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Transform the data for the API response
    const transformedConversations = conversations.map(conv => ({
      id: conv.id,
      bookingId: conv.bookingId,
      customer: conv.customer,
      driver: conv.driver,
      booking: conv.booking,
      lastMessage: conv.messages[0] || null,
      messageCount: conv._count.messages,
      status: conv.status,
      updatedAt: conv.updatedAt,
      // Determine if current user is customer or driver
      isCustomer: conv.customerId === session.user.id,
      isDriver: conv.driverId === session.user.id,
    }));

    return NextResponse.json({
      conversations: transformedConversations,
    });
  } catch (error) {
    console.error('[GET /api/chat/conversations] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

// POST /api/chat/conversations - Create a conversation for a booking
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthSession(request);

    const body = await request.json();
    const { bookingId } = body;

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Booking ID is required' },
        { status: 400 }
      );
    }

    // Get the booking and verify it exists and has a driver assigned
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        userId: true,
        driverId: true,
        status: true,
        taskStatus: true,
        chatConversation: {
          select: { id: true },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    if (!booking.driverId) {
      return NextResponse.json(
        { error: 'Booking must have a driver assigned' },
        { status: 400 }
      );
    }

    // Check if conversation already exists
    if (booking.chatConversation) {
      // Return the existing conversation instead of an error
      const existingConversation = await prisma.chatConversation.findUnique({
        where: { id: booking.chatConversation.id },
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

      if (!existingConversation) {
        return NextResponse.json(
          { error: 'Conversation exists but could not be retrieved' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        data: {
          id: existingConversation.id,
          bookingId: existingConversation.bookingId,
          customer: existingConversation.customer,
          driver: existingConversation.driver,
          booking: existingConversation.booking,
          status: existingConversation.status,
          createdAt: existingConversation.createdAt,
          updatedAt: existingConversation.updatedAt,
        },
      });
    }

    // Verify user has permission (customer or admin/driver)
    const isCustomer = booking.userId === session.user.id;
    const isDriver = booking.driverId === session.user.id;
    const isAdmin = session.user.role === 'ADMIN';

    if (!isCustomer && !isDriver && !isAdmin) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Create the conversation
    const conversation = await prisma.chatConversation.create({
      data: {
        bookingId,
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

    // Create a system message to indicate the conversation started
    await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        senderId: session.user.id,
        senderType: 'CUSTOMER', // Use CUSTOMER as sender for system messages
        message: `Chat conversation started for ${conversation.booking.service.name} service`,
        messageType: 'SYSTEM', // Mark as system message type
      },
    });

    return NextResponse.json({
      data: {
        id: conversation.id,
        bookingId: conversation.bookingId,
        customer: conversation.customer,
        driver: conversation.driver,
        booking: conversation.booking,
        status: conversation.status,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    });
  } catch (error) {
    console.error('[POST /api/chat/conversations] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
