import { NextRequest, NextResponse } from 'next/server';
import { requireAuthSession } from '@/lib/auth';
import { getMobileUserFromRequest } from '@/lib/mobile-session';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

async function resolveUser(request: NextRequest): Promise<{ id: string; role: string } | null> {
  const mobileUser = await getMobileUserFromRequest(request);
  if (mobileUser) return { id: mobileUser.sub, role: mobileUser.role };
  try {
    const session = await requireAuthSession(request);
    return { id: session.user.id, role: session.user.role ?? 'USER' };
  } catch {
    return null;
  }
}

const sendMessageSchema = z.object({
  message: z.string().min(1).max(1000),
  messageType: z.enum(['TEXT', 'IMAGE', 'SYSTEM']).default('TEXT'),
});

// GET /api/chat/conversations/[conversationId]/messages - Get messages for a conversation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const currentUser = await resolveUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { conversationId } = await params;

    // Get the conversation and verify user has access
    const conversation = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        customerId: true,
        driverId: true,
        status: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Check if user has access to this conversation
    if (conversation.customerId !== currentUser.id && conversation.driverId !== currentUser.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get messages
    const messages = await prisma.chatMessage.findMany({
      where: { conversationId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Mark messages as read if user is the recipient
    const userRole = conversation.customerId === currentUser.id ? 'CUSTOMER' : 'DRIVER';
    const otherRole = userRole === 'CUSTOMER' ? 'DRIVER' : 'CUSTOMER';

    await prisma.chatMessage.updateMany({
      where: {
        conversationId,
        senderType: otherRole,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      messages: messages.map(msg => ({
        id: msg.id,
        message: msg.message,
        messageType: msg.messageType,
        sender: msg.User,
        senderType: msg.senderType,
        readAt: msg.readAt,
        createdAt: msg.createdAt,
      })),
    });
  } catch (error) {
    console.error('[GET /api/chat/conversations/[id]/messages] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// POST /api/chat/conversations/[conversationId]/messages - Send a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const currentUser = await resolveUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { conversationId } = await params;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    // Get the conversation and verify user has access
    const conversation = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        customerId: true,
        driverId: true,
        status: true,
        Booking: {
          select: {
            status: true,
            taskStatus: true,
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Check if conversation is active
    if (conversation.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Conversation is not active' },
        { status: 400 }
      );
    }

    // Check if user has access to this conversation
    if (conversation.customerId !== currentUser.id && conversation.driverId !== currentUser.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Determine sender type
    const senderType = conversation.customerId === currentUser.id ? 'CUSTOMER' : 'DRIVER';

    // Parse and validate request body
    const body = await request.json();
    const validation = sendMessageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { message, messageType } = validation.data;

    // Create the message
    const newMessage = await prisma.chatMessage.create({
      data: {
        conversationId,
        senderId: currentUser.id,
        senderType,
        message,
        messageType,
      } as any,
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // Update conversation updatedAt
    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Emit real-time event to other participants
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const io = (global as any).__socketServer;
    if (io) {
      const otherUserId = conversation.customerId === currentUser.id
        ? conversation.driverId
        : conversation.customerId;

      // Emit to the other user in the conversation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const otherUserSockets = (global as any).connectedClients?.get(otherUserId);
      if (otherUserSockets && otherUserSockets.size > 0) {
        const messageEvent = {
          type: 'chat.message.new',
          conversationId,
          message: {
            id: newMessage.id,
            message: newMessage.message,
            messageType: newMessage.messageType,
            sender: newMessage.User,
            senderType: newMessage.senderType,
            createdAt: newMessage.createdAt,
          },
          timestamp: Date.now(),
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        otherUserSockets.forEach((socket: any) => {
          if (socket && socket.connected) {
            socket.emit('live-update', messageEvent);
          }
        });

        console.log(`[Chat] Emitted new message to ${otherUserId}`);
      }

      // Also emit to chat room for any connected clients
      io.to(`chat:${conversationId}`).emit('chat_message', {
        conversationId,
        message: {
          id: newMessage.id,
          message: newMessage.message,
          messageType: newMessage.messageType,
          sender: newMessage.User,
          senderType: newMessage.senderType,
          createdAt: newMessage.createdAt,
        },
      });
    }

    return NextResponse.json({
      data: {
        id: newMessage.id,
        message: newMessage.message,
        messageType: newMessage.messageType,
        sender: newMessage.User,
        senderType: newMessage.senderType,
        readAt: newMessage.readAt,
        createdAt: newMessage.createdAt,
      },
    });
  } catch (error) {
    console.error('[POST /api/chat/conversations/[id]/messages] Error:', error);
    console.error('[POST /api/chat/conversations/[id]/messages] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      conversationId: 'unknown',
    });
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
