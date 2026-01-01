import { NextRequest, NextResponse } from 'next/server';
import { emitBusinessEvent } from '@/lib/business-events';

export async function POST(request: NextRequest) {
  try {
    const { eventType, userId, bookingId } = await request.json();

    console.log('[TestEvent] Received test event request:', { eventType, userId, bookingId });

    // Emit a test event
    emitBusinessEvent('booking.updated', {
      bookingId: bookingId || 'test-booking-123',
      userId: userId || 'test-user-456'
    });

    return NextResponse.json({
      success: true,
      message: `Emitted ${eventType} event`,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[TestEvent] Error:', error);
    return NextResponse.json(
      { error: 'Failed to emit test event' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Emit a test event on GET request for easy testing
  console.log('[TestEvent] GET request - emitting test event');

  emitBusinessEvent('booking.updated', {
    bookingId: 'test-booking-123',
    userId: 'test-user-456'
  });

  return NextResponse.json({
    success: true,
    message: 'Test event emitted - check mobile app logs',
    timestamp: Date.now()
  });
}
