import { NextRequest, NextResponse } from 'next/server';
import { sendToUser } from '@/lib/notifications-v2';

export async function POST(req: NextRequest) {
  try {
    const requestBody = await req.json();
    const { userId, appType, title, body: notificationBody } = requestBody;

    if (!userId || !title || !notificationBody) {
      return NextResponse.json({ error: 'Missing required fields: userId, title, body' }, { status: 400 });
    }

    // Default to CUSTOMER if appType not specified
    const resolvedAppType = appType === 'DRIVER' ? 'DRIVER' : 'CUSTOMER';

    console.log('[Test Notification] Sending test notification to user:', userId, 'appType:', resolvedAppType);
    
    const notificationId = await sendToUser(userId, resolvedAppType, {
      title,
      body: notificationBody,
      category: 'SYSTEM',
    });

    console.log('[Test Notification] Result:', notificationId);

    return NextResponse.json({ success: true, notificationId });
  } catch (error) {
    console.error('[Test Notification] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
