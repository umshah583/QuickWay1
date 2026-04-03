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
  let conversationId: string | undefined;
  
  try {
    const currentUser = await resolveUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const resolvedParams = await params;
    conversationId = resolvedParams.conversationId;

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

    // Get messages - optimized query with pagination support
    const messages = await prisma.chatMessage.findMany({
      where: { conversationId },
      select: {
        id: true,
        message: true,
        messageType: true,
        senderType: true,
        readAt: true,
        createdAt: true,
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
      // Add pagination for better performance with many messages
      take: 50, // Load last 50 messages
    });

    // Mark messages as read if user is the recipient - async for speed
    const userRole = conversation.customerId === currentUser.id ? 'CUSTOMER' : 'DRIVER';
    const otherRole = userRole === 'CUSTOMER' ? 'DRIVER' : 'CUSTOMER';

    // Update read status asynchronously (non-blocking)
    prisma.chatMessage.updateMany({
      where: {
        conversationId,
        senderType: otherRole,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    }).catch(error => {
      console.error('[Chat] Failed to update read status:', error);
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
  let conversationId: string | undefined;
  
  try {
    const currentUser = await resolveUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const resolvedParams = await params;
    conversationId = resolvedParams.conversationId;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    // Get the conversation and verify user has access - optimized query
    const conversation = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        customerId: true,
        driverId: true,
        status: true,
        // Only include Booking if absolutely necessary for validation
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

    // Performance tracking
    const startTime = performance.now();
    console.log('[Chat] Message sending started at:', startTime);

    // Create the message - use raw SQL for maximum speed
    const messageId = `msg-${conversationId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    console.log('[Chat] Starting raw SQL insert at:', performance.now() - startTime);
    
    // Ultra-fast raw SQL insert
    await prisma.$executeRaw`
      INSERT INTO "ChatMessage" (
        "id", "conversationId", "senderId", "senderType", "message", "messageType", "createdAt", "updatedAt"
      ) VALUES (
        ${messageId}, ${conversationId}, ${currentUser.id}, ${senderType}::"ChatSenderType", 
        ${message}, ${messageType}::"ChatMessageType", ${now}, ${now}
      )
    `;

    console.log('[Chat] Raw SQL insert completed at:', performance.now() - startTime);
    
    // Ultra-fast single query to get message and user data
    const messageResult = await prisma.$queryRaw`
      SELECT 
        m.id,
        m.message,
        m."messageType",
        m."senderType",
        m."readAt",
        m."createdAt",
        u.id as "userId",
        u.name as "userName",
        u.image as "userImage"
      FROM "ChatMessage" m
      LEFT JOIN "User" u ON m."senderId" = u.id
      WHERE m.id = ${messageId}
    ` as any[];

    console.log('[Chat] Message + user fetch completed at:', performance.now() - startTime);

    // Prepare response data from raw query result
    const messageData = messageResult[0];
    const responseData = {
      id: messageData.id,
      message: messageData.message,
      messageType: messageData.messageType,
      sender: {
        id: messageData.userId,
        name: messageData.userName,
        image: messageData.userImage,
      },
      senderType: messageData.senderType,
      readAt: messageData.readAt,
      createdAt: messageData.createdAt,
    };

    console.log('[Chat] Sending response at:', performance.now() - startTime);
    console.log('[Chat] Total request time:', performance.now() - startTime);
    
    // Return response IMMEDIATELY
    const response = NextResponse.json({
      data: responseData,
    });

    // Do everything else in the background (non-blocking)
    setTimeout(async () => {
      try {
        console.log('[Chat] Background operations started at:', performance.now() - startTime);
        
        // Emit real-time event
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const io = (global as any).__socketServer;
        if (io) {
          const otherUserId = conversation.customerId === currentUser.id
            ? conversation.driverId
            : conversation.customerId;

          const messageEvent = {
            type: 'chat.message.new',
            conversationId,
            message: responseData,
            timestamp: Date.now(),
          };

          // Emit to the other user
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const otherUserSockets = (global as any).connectedClients?.get(otherUserId);
          if (otherUserSockets && otherUserSockets.size > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            otherUserSockets.forEach((socket: any) => {
              if (socket && socket.connected) {
                socket.emit('live-update', messageEvent);
              }
            });
          }

          io.to(`chat:${conversationId}`).emit('chat_message', {
            conversationId,
            message: responseData,
          });
        }

        // Update conversation timestamp
        await prisma.chatConversation.update({
          where: { id: conversationId },
          data: { updatedAt: now },
        });

        console.log('[Chat] Background operations completed at:', performance.now() - startTime);
      } catch (error) {
        console.error('[Chat] Background operations failed:', error);
      }
    }, 0);

    return response;
  } catch (error: any) {
    console.error('[POST /api/chat/conversations/[id]/messages] Error:', error);
    console.error('[POST /api/chat/conversations/[id]/messages] Error details:', {
      message: error?.message || 'Unknown error',
      stack: error?.stack || undefined,
      conversationId: conversationId || 'unknown',
    });
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
