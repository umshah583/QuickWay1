import { NextRequest, NextResponse } from 'next/server';
import { requireAuthSession } from '@/lib/auth';
import { getMobileUserFromRequest } from '@/lib/mobile-session';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { sendToUser } from '@/lib/notifications-v2';

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

    // Check if user has access to this conversation (admin users can access all)
    const isAdmin = currentUser.role === 'ADMIN';
    if (!isAdmin && conversation.customerId !== currentUser.id && conversation.driverId !== currentUser.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get messages - fetch all messages (no limit)
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
        delivered: true, // All messages in DB are considered delivered
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

    // Check if user has access to this conversation (admin users can access all)
    const isAdmin = currentUser.role === 'ADMIN';
    if (!isAdmin && conversation.customerId !== currentUser.id && conversation.driverId !== currentUser.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Determine sender type (admin users send as ADMIN)
    let senderType: 'CUSTOMER' | 'DRIVER' | 'ADMIN';
    if (isAdmin) {
      senderType = 'ADMIN';
    } else if (conversation.customerId === currentUser.id) {
      senderType = 'CUSTOMER';
    } else {
      senderType = 'DRIVER';
    }

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
      delivered: true, // Message is delivered once saved to DB
      createdAt: messageData.createdAt,
    };

    console.log('[Chat] Sending response at:', performance.now() - startTime);
    console.log('[Chat] Total request time:', performance.now() - startTime);
    
    // Emit real-time event IMMEDIATELY (not in timeout)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const io = (globalThis as any).__socketServer || (global as any).__socketServer;
    const clients = (globalThis as any).connectedClients || (global as any).connectedClients;
    
    console.log('[Chat] Socket.IO server available:', !!io);
    console.log('[Chat] ConnectedClients map available:', !!clients);
    console.log('[Chat] ConnectedClients size:', clients?.size || 0);
    console.log('[Chat] ConnectedClients keys:', Array.from(clients?.keys() || []));
    
    if (io) {
      console.log('[Chat] 🚀 Socket.IO broadcast starting for conversation:', conversationId);
      
      const messageEvent = {
        type: 'chat.message.new',
        conversationId,
        message: responseData,
        timestamp: Date.now(),
      };

      // Emit to BOTH customer and driver for real-time acknowledgment/delivery
      const userIds = [conversation.customerId, conversation.driverId];
      console.log('[Chat] Target user IDs:', userIds);
      
      userIds.forEach(userId => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userSockets = clients?.get(userId);
        console.log(`[Chat] User ${userId} - sockets found:`, userSockets?.size || 0);
        
        if (userSockets && userSockets.size > 0) {
          console.log(`[Chat] ✅ Found ${userSockets.size} sockets for user ${userId}`);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          userSockets.forEach((socket: any) => {
            console.log(`[Chat] Socket ${socket?.id} - connected: ${socket?.connected}, rooms:`, socket?.rooms ? Array.from(socket.rooms) : 'none');
            if (socket && socket.connected) {
              console.log(`[Chat] 📤 Emitting 'live-update' to socket ${socket.id}`);
              socket.emit('live-update', messageEvent);
            } else {
              console.log(`[Chat] ⚠️ Socket ${socket?.id} not connected, skipping`);
            }
          });
        } else {
          console.log(`[Chat] ❌ No active sockets found for user ${userId}`);
        }
      });

      // Emit to chat room (includes admin users and anyone joined)
      const roomName = `chat:${conversationId}`;
      console.log(`[Chat] 🏠 Room name: ${roomName}`);
      console.log(`[Chat] Room exists:`, io.sockets.adapter.rooms.has(roomName));
      console.log(`[Chat] Room members:`, io.sockets.adapter.rooms.get(roomName)?.size || 0);
      
      io.to(roomName).emit('chat_message', {
        conversationId,
        message: responseData,
        timestamp: Date.now(),
      });
      console.log(`[Chat] 🏁 Emitted 'chat_message' to room: ${roomName}`);

      console.log('[Chat] 🏁 Socket.IO broadcast completed at:', performance.now() - startTime);
    } else {
      console.error('[Chat] ❌ Socket.IO server not found in global object!');
    }

    // Return response IMMEDIATELY
    const response = NextResponse.json({
      data: responseData,
    });

    // Do other operations in background (non-blocking)
    setTimeout(async () => {
      try {
        console.log('[Chat] Background operations started at:', performance.now() - startTime);
        
        // Update conversation timestamp
        await prisma.chatConversation.update({
          where: { id: conversationId },
          data: { updatedAt: now },
        });

        // Send push notification to recipient if chat is not open
        // Determine recipient (the person who didn't send the message)
        const recipientId = conversation.customerId === currentUser.id 
          ? conversation.driverId 
          : conversation.customerId;
        
        const recipientAppType = conversation.customerId === currentUser.id 
          ? 'DRIVER' 
          : 'CUSTOMER';
        
        const recipientName = conversation.customerId === currentUser.id
          ? 'Driver'
          : 'Customer';

        console.log('[Chat] Sending push notification to recipient:', recipientId, 'appType:', recipientAppType);

        // Send push notification using notifications-v2
        // This system automatically checks if user has active socket connection
        // If no socket, it sends via FCM (push notification)
        await sendToUser(recipientId, recipientAppType, {
          title: 'New Message',
          body: `${messageData.sender.name}: ${message}`,
          category: 'SYSTEM',
          entityType: 'conversation',
          entityId: conversationId,
          actionUrl: `/chat/${conversationId}`,
          payload: {
            conversationId,
            messageId: messageData.id,
            senderId: currentUser.id,
            senderName: messageData.sender.name,
          },
        }).catch(error => {
          console.error('[Chat] Failed to send push notification:', error);
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
