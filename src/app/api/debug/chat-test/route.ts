import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    console.log('[ChatTest] Starting chat system debug...');
    
    // 1. Check for existing conversations
    const conversations = await prisma.chatConversation.findMany({
      take: 5,
      include: {
        Booking: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });
    
    console.log('[ChatTest] Found conversations:', conversations.length);
    
    // 2. Check for recent messages
    const messages = await prisma.chatMessage.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        ChatConversation: {
          select: {
            id: true,
            bookingId: true,
          },
        },
      },
    });
    
    console.log('[ChatTest] Found recent messages:', messages.length);
    
    // 3. Check Socket.IO server status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const io = (global as any).__socketServer;
    const socketServerStatus = {
      exists: !!io,
      connectedClients: Object.keys((global as any).connectedClients || {}).length,
    };
    
    console.log('[ChatTest] Socket.IO status:', socketServerStatus);
    
    return NextResponse.json({
      success: true,
      data: {
        conversations: conversations.map(c => ({
          id: c.id,
          bookingId: c.bookingId,
          status: c.status,
          bookingStatus: c.Booking?.status,
        })),
        messages: messages.map(m => ({
          id: m.id,
          conversationId: m.conversationId,
          message: m.message,
          senderType: m.senderType,
          createdAt: m.createdAt,
        })),
        socketServer: socketServerStatus,
      },
    });
  } catch (error) {
    console.error('[ChatTest] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
