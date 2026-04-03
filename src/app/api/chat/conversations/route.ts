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
    const transformedConversations = conversations.map(conv => {
      const transformed = {
        id: conv.id,
        bookingId: conv.bookingId,
        customer: conv.User_ChatConversation_customerIdToUser,
        driver: conv.User_ChatConversation_driverIdToUser,
        booking: {
          ...conv.Booking,
          service: conv.Booking.Service || { name: 'Service' }, // Use lowercase 'service' to match frontend
        },
        lastMessage: conv.ChatMessage[0] || null,
        messageCount: conv._count.ChatMessage,
        status: conv.status,
        updatedAt: conv.updatedAt,
        // Determine if current user is customer or driver
        isCustomer: conv.customerId === currentUser.id,
        isDriver: conv.driverId === currentUser.id,
      };
      
      console.log('[GET /api/chat/conversations] Transformed conversation:', transformed);
      return transformed;
    });

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
    console.log('[POST /api/chat/conversations] Request started');
    
    const currentUser = await resolveUser(request);
    if (!currentUser) {
      console.log('[POST /api/chat/conversations] Unauthorized - no user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[POST /api/chat/conversations] Authenticated user:', currentUser);

    const body = await request.json();
    console.log('[POST /api/chat/conversations] Request body:', body);
    
    const { bookingId } = body;

    if (!bookingId) {
      console.log('[POST /api/chat/conversations] Missing bookingId');
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
        serviceId: true,
        ChatConversation: {
          select: { id: true },
        },
      },
    });

    console.log('[POST /api/chat/conversations] Found booking:', booking);

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
      console.log('[POST /api/chat/conversations] Conversation already exists:', booking.ChatConversation.id);
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

      const responseData = {
        id: existingConversation.id,
        bookingId: existingConversation.bookingId,
        customer: existingConversation.User_ChatConversation_customerIdToUser || { id: '', name: 'Unknown', image: null },
        driver: existingConversation.User_ChatConversation_driverIdToUser || { id: '', name: 'Unknown', image: null },
        booking: {
          ...existingConversation.Booking,
          service: existingConversation.Booking.Service || { name: 'Service' }, // Use lowercase 'service' to match frontend
        },
        status: existingConversation.status,
        createdAt: existingConversation.createdAt,
        updatedAt: existingConversation.updatedAt,
      };

      console.log('[POST /api/chat/conversations] Returning existing conversation:', responseData);
      console.log('[POST /api/chat/conversations] Service name in response:', responseData.booking.service?.name);

      return NextResponse.json({
        data: responseData,
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
        id: `chat-${bookingId}-${Date.now()}`, // Generate unique conversation ID
        bookingId,
        customerId: booking.userId,
        driverId: booking.driverId,
        createdAt: new Date(),
        updatedAt: new Date(),
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

    console.log('[POST /api/chat/conversations] Created conversation:', conversation);
    console.log('[POST /api/chat/conversations] Booking Service:', conversation.Booking.Service);
    console.log('[POST /api/chat/conversations] Conversation data being returned:', {
      id: conversation.id,
      bookingId: conversation.bookingId,
      customer: conversation.User_ChatConversation_customerIdToUser,
      driver: conversation.User_ChatConversation_driverIdToUser,
      booking: conversation.Booking,
      status: conversation.status,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    });

    // Create a system message to indicate the conversation started
    const serviceName = conversation.Booking.Service?.name || 'Service';
    await prisma.chatMessage.create({
      data: {
        id: `msg-${conversation.id}-${Date.now()}`, // Generate unique message ID
        conversationId: conversation.id,
        senderId: currentUser.id,
        senderType: 'CUSTOMER', // Use CUSTOMER as sender for system messages
        message: `Chat conversation started for ${serviceName} service`,
        messageType: 'SYSTEM', // Mark as system message type
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    });

    const responseData = {
      id: conversation.id,
      bookingId: conversation.bookingId,
      customer: conversation.User_ChatConversation_customerIdToUser || { id: '', name: 'Unknown', image: null },
      driver: conversation.User_ChatConversation_driverIdToUser || { id: '', name: 'Unknown', image: null },
      booking: {
        ...conversation.Booking,
        service: conversation.Booking.Service || { name: 'Service' }, // Use lowercase 'service' to match frontend
      },
      status: conversation.status,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };

    console.log('[POST /api/chat/conversations] Final response data:', responseData);
    console.log('[POST /api/chat/conversations] Service name in final response:', responseData.booking.service?.name);

    return NextResponse.json({
      data: responseData,
    });
  } catch (error: any) {
    console.error('[POST /api/chat/conversations] Error:', error);
    console.error('[POST /api/chat/conversations] Error message:', error?.message);
    console.error('[POST /api/chat/conversations] Error stack:', error?.stack);
    console.error('[POST /api/chat/conversations] Error details:', JSON.stringify(error, null, 2));
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
