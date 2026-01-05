import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import { sendBroadcastNotification } from '@/lib/notifications-v2';
import { jsonResponse, errorResponse } from '@/lib/api-response';

const schema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(500),
  appType: z.enum(['CUSTOMER', 'DRIVER']),
});

export async function POST(req: NextRequest) {
  console.log('[PromoNotifications] ========== API ENDPOINT CALLED ==========');
  
  const session = await getServerSession(authOptions);
  console.log('[PromoNotifications] Session:', session ? `User ${session.user?.email} (${session.user?.role})` : 'NO_SESSION');
  
  if (!session?.user || session.user.role !== 'ADMIN') {
    console.log('[PromoNotifications] ❌ Unauthorized - not admin');
    return errorResponse('Unauthorized', 401);
  }

  const body = await req.json().catch(() => null);
  console.log('[PromoNotifications] Request body:', body);
  
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    console.log('[PromoNotifications] ❌ Validation failed:', parsed.error);
    return errorResponse('Invalid input', 400);
  }

  const { title, body: notificationBody, appType } = parsed.data;
  console.log('[PromoNotifications] Validated input:', { title, body: notificationBody, appType });

  try {
    console.log('[PromoNotifications] Calling sendBroadcastNotification...');
    const result = await sendBroadcastNotification(appType, title, notificationBody);
    console.log('[PromoNotifications] ✅ Result:', result);
    return jsonResponse(result);
  } catch (error) {
    console.error('[PromoNotifications] ❌ Error:', error);
    return errorResponse('Failed to send broadcast notification', 500);
  }
}
