import { NextRequest, NextResponse } from 'next/server';
import { requireAuthSession } from '@/lib/auth';
import { getMobileUserFromRequest } from '@/lib/mobile-session';
import { prisma } from '@/lib/prisma';

async function resolveUser(request: NextRequest): Promise<{ id: string; role: string } | null> {
  // Try mobile JWT first
  const mobileUser = await getMobileUserFromRequest(request);
  if (mobileUser) return { id: mobileUser.sub, role: mobileUser.role };
  // Fall back to web session
  try {
    const session = await requireAuthSession(request);
    return { id: session.user.id, role: session.user.role ?? 'USER' };
  } catch {
    return null;
  }
}

// GET /api/chat/conversations - Get user's conversations
export async function GET(request: NextRequest) {
  try {
    const currentUser = await resolveUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get conversations for the current user (either as customer or driver)
    const conversations = await prisma.chatConversation.findMany({
      where: {
        OR: [
          { customerId: currentUser.id },
          { driverId: currentUser.id },
        ],
        status: 'ACTIVE',
      },
      include: {
        Booking: {
          select: {
            id: true,
            startAt: true,
            Service: {
              select: {
                name: true,
              },
            },
            status: true,
            taskStatus: true,
          },
        },
        User_ChatConversation_customerIdToUser: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        User_ChatConversation_driverIdToUser: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        ChatMessage: {
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
            ChatMessage: true,
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
      customer: conv.User_ChatConversation_customerIdToUser,
      driver: conv.User_ChatConversation_driverIdToUser,
      booking: conv.Booking,
      lastMessage: conv.ChatMessage[0] || null,
      messageCount: conv._count.ChatMessage,
      status: conv.status,
      updatedAt: conv.updatedAt,
      // Determine if current user is customer or driver
      isCustomer: conv.customerId === currentUser.id,
      isDriver: conv.driverId === currentUser.id,
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
    const currentUser = await resolveUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
        ChatConversation: {
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
    if (booking.ChatConversation) {
      // Return the existing conversation instead of an error
      const existingConversation = await prisma.chatConversation.findUnique({
        where: { id: booking.ChatConversation.id },
        include: {
          Booking: {
            select: {
              id: true,
              startAt: true,
              Service: {
                select: { name: true },
              },
            },
          },
          User_ChatConversation_customerIdToUser: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          User_ChatConversation_driverIdToUser: {
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
          customer: existingConversation.User_ChatConversation_customerIdToUser,
          driver: existingConversation.User_ChatConversation_driverIdToUser,
          booking: existingConversation.Booking,
          status: existingConversation.status,
          createdAt: existingConversation.createdAt,
          updatedAt: existingConversation.updatedAt,
        },
      });
    }

    // Verify user has permission (customer or admin/driver)
    const isCustomer = booking.userId === currentUser.id;
    const isDriver = booking.driverId === currentUser.id;
    const isAdmin = currentUser.role === 'ADMIN';

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
      } as any,
      include: {
        Booking: {
          select: {
            id: true,
            startAt: true,
            Service: {
              select: { name: true },
            },
          },
        },
        User_ChatConversation_customerIdToUser: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        User_ChatConversation_driverIdToUser: {
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
        senderId: currentUser.id,
        senderType: 'CUSTOMER', // Use CUSTOMER as sender for system messages
        message: `Chat conversation started for ${conversation.Booking.Service.name} service`,
        messageType: 'SYSTEM', // Mark as system message type
      } as any,
    });

    return NextResponse.json({
      data: {
        id: conversation.id,
        bookingId: conversation.bookingId,
        customer: conversation.User_ChatConversation_customerIdToUser,
        driver: conversation.User_ChatConversation_driverIdToUser,
        booking: conversation.Booking,
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
