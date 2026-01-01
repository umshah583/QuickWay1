import { NextRequest, NextResponse } from 'next/server';
import { getMobileUserFromRequest } from '@/lib/mobile-session';
import { sendToUser } from '@/lib/notifications-v2';

export async function POST(req: NextRequest) {
  console.log('[TEST-FCM] ========== TEST NOTIFICATIONS V2 ==========');

  try {
    const mobileUser = await getMobileUserFromRequest(req);
    console.log('[TEST-FCM] User authenticated:', mobileUser?.sub);

    if (!mobileUser) {
      console.log('[TEST-FCM] No authenticated user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log('[TEST-FCM] Request body:', body);

    const { title = "Test Notification", body: messageBody = "This is a test notification" } = body;

    // Determine appType based on user role
    const appType = mobileUser.role === 'DRIVER' ? 'DRIVER' : 'CUSTOMER';

    console.log(`[TEST-FCM] Sending test notification to user ${mobileUser.sub} as ${appType}`);
    console.log(`[TEST-FCM] Title: "${title}", Body: "${messageBody}"`);

    await sendToUser(mobileUser.sub, appType, {
      title,
      body: messageBody,
      category: 'SYSTEM',
    });

    console.log('[TEST-FCM] ✅ Test notification sent successfully');
    console.log('[TEST-FCM] ========== TEST COMPLETE ==========');

    return NextResponse.json({
      success: true,
      message: 'Test notification sent via notifications-v2',
      userId: mobileUser.sub,
      appType,
    });

  } catch (error) {
    console.error('[TEST-FCM] ❌ Error sending test FCM:', error);
    return NextResponse.json({
      error: 'Failed to send test FCM',
      details: error instanceof Error ? error.message : error
    }, { status: 500 });
  }
}
