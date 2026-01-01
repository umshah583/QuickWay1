/**
 * NOTIFICATIONS V2 API - UNREAD COUNT
 * GET /api/notifications-v2/unread-count?appType=CUSTOMER|DRIVER
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-session';
import type { AppType } from '@/lib/notifications-v2/types';

export async function GET(req: NextRequest) {
  try {
    // Get auth token
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = await verifyMobileToken(token);
    const userId = payload.sub;

    // Get query params
    const { searchParams } = new URL(req.url);
    const appType = searchParams.get('appType') as AppType;

    // REQUIRED: appType must be specified
    if (!appType || !['CUSTOMER', 'DRIVER'].includes(appType)) {
      return NextResponse.json(
        { error: 'appType query parameter is required (CUSTOMER or DRIVER)' },
        { status: 400 }
      );
    }

    // Count unread notifications - ALWAYS filtered by userId AND appType
    const count = await prisma.notificationV2.count({
      where: {
        userId,
        appType,
        status: { not: 'READ' },
      },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error('[NotificationsV2 API] Unread count error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
