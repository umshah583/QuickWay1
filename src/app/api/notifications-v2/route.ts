/**
 * NOTIFICATIONS V2 API - LIST NOTIFICATIONS
 * GET /api/notifications-v2?appType=CUSTOMER|DRIVER
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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    // REQUIRED: appType must be specified
    if (!appType || !['CUSTOMER', 'DRIVER'].includes(appType)) {
      return NextResponse.json(
        { error: 'appType query parameter is required (CUSTOMER or DRIVER)' },
        { status: 400 }
      );
    }

    // Build query - ALWAYS filtered by userId AND appType
    const where = {
      userId,
      appType,
      ...(unreadOnly && { status: { not: 'READ' as const } }),
    };

    // Fetch notifications
    const [notifications, total] = await Promise.all([
      prisma.notificationV2.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          body: true,
          category: true,
          entityType: true,
          entityId: true,
          actionUrl: true,
          payload: true,
          status: true,
          createdAt: true,
          readAt: true,
        },
      }),
      prisma.notificationV2.count({ where }),
    ]);

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
        readAt: n.readAt?.toISOString() ?? null,
        read: n.status === 'READ',
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[NotificationsV2 API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
