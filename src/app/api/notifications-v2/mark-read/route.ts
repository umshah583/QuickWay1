/**
 * NOTIFICATIONS V2 API - MARK AS READ
 * PATCH /api/notifications-v2/mark-read
 * Body: { appType, notificationIds?: string[], markAllRead?: boolean }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-session';
import type { AppType } from '@/lib/notifications-v2/types';

export async function PATCH(req: NextRequest) {
  try {
    // Get auth token
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = await verifyMobileToken(token);
    const userId = payload.sub;

    // Parse body
    const body = await req.json();
    const { appType, notificationIds, markAllRead } = body as {
      appType: AppType;
      notificationIds?: string[];
      markAllRead?: boolean;
    };

    // REQUIRED: appType must be specified
    if (!appType || !['CUSTOMER', 'DRIVER'].includes(appType)) {
      return NextResponse.json(
        { error: 'appType is required in request body (CUSTOMER or DRIVER)' },
        { status: 400 }
      );
    }

    let markedCount = 0;

    if (markAllRead) {
      // Mark ALL unread notifications as read for this user+app
      const result = await prisma.notificationV2.updateMany({
        where: {
          userId,
          appType,
          status: { not: 'READ' },
        },
        data: {
          status: 'READ',
          readAt: new Date(),
        },
      });
      markedCount = result.count;
    } else if (notificationIds && notificationIds.length > 0) {
      // Mark specific notifications as read
      // SECURITY: Only update notifications belonging to this user AND appType
      const result = await prisma.notificationV2.updateMany({
        where: {
          id: { in: notificationIds },
          userId,
          appType,
          status: { not: 'READ' },
        },
        data: {
          status: 'READ',
          readAt: new Date(),
        },
      });
      markedCount = result.count;
    } else {
      return NextResponse.json(
        { error: 'Either notificationIds array or markAllRead: true is required' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      markedCount,
    });
  } catch (error) {
    console.error('[NotificationsV2 API] Mark read error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
