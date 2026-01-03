import { NextRequest, NextResponse } from 'next/server';
import { getMobileUserFromRequest } from '@/lib/mobile-session';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  console.log('[FCM] 🚨 ========== FCM REGISTRATION API CALLED ==========');
  console.log('[FCM] Request headers:', Object.fromEntries(req.headers.entries()));

  try {
    const mobileUser = await getMobileUserFromRequest(req);
    console.log('[FCM] Mobile user authenticated:', mobileUser ? `User ${mobileUser.sub}` : 'NO_USER');

    if (!mobileUser) {
      console.log('[FCM] ❌ No authenticated user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log('[FCM] Request body received:', body);
    console.log('[FCM] FCM token in body:', body.fcmToken ? `${body.fcmToken.substring(0, 50)}...` : 'NO_TOKEN');
    console.log('[FCM] appType in body:', body.appType);
    console.log('[FCM] platform in body:', body.platform);

    const { fcmToken, appType, platform } = body;

    if (!fcmToken) {
      console.log('[FCM] ❌ No FCM token provided in request');
      return NextResponse.json({ error: 'FCM token required' }, { status: 400 });
    }

    if (!appType || !['CUSTOMER', 'DRIVER'].includes(appType)) {
      console.log('[FCM] ❌ Invalid or missing appType:', appType);
      return NextResponse.json({ error: 'Valid appType (CUSTOMER or DRIVER) required' }, { status: 400 });
    }

    if (!platform || !['ios', 'android'].includes(platform)) {
      console.log('[FCM] ❌ Invalid or missing platform:', platform);
      return NextResponse.json({ error: 'Valid platform (ios or android) required' }, { status: 400 });
    }

    console.log(`[FCM] 🔄 Storing FCM token for user ${mobileUser.sub}, appType: ${appType}, platform: ${platform}...`);

    // Store in new FCMToken model (upsert to handle updates)
    // Note: This stores the token even if Firebase Admin isn't available for sending
    const fcmTokenRecord = await prisma.fCMToken.upsert({
      where: {
        userId_appType_platform: {
          userId: mobileUser.sub,
          appType: appType as 'CUSTOMER' | 'DRIVER',
          platform: platform as 'ios' | 'android',
        },
      },
      update: {
        token: fcmToken,
      },
      create: {
        userId: mobileUser.sub,
        token: fcmToken,
        appType: appType as 'CUSTOMER' | 'DRIVER',
        platform: platform as 'ios' | 'android',
      },
    });

    console.log(`[FCM] ✅ Token stored for user ${mobileUser.sub}: ${fcmToken.substring(0, 50)}...`);
    console.log(`[FCM] Record ID: ${fcmTokenRecord.id}`);
    console.log('[FCM] ⚠️ Warning: Firebase Admin not initialized - FCM push notifications will not work');
    console.log('[FCM] ========== FCM REGISTRATION COMPLETE (STORAGE ONLY) ==========');

    return NextResponse.json({
      success: true,
      warning: 'Firebase Admin not initialized - push notifications may not work'
    });
  } catch (error) {
    console.error('[FCM] ❌ Registration error:', error);
    console.error('[FCM] Error type:', typeof error);
    console.error('[FCM] Error name:', error instanceof Error ? error.name : 'Unknown');
    console.error('[FCM] Error message:', error instanceof Error ? error.message : error);
    console.error('[FCM] Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes('prisma') || error.message.includes('database')) {
        console.error('[FCM] Database connection error detected');
      } else if (error.message.includes('auth') || error.message.includes('token')) {
        console.error('[FCM] Authentication error detected');
      } else if (error.message.includes('firebase') || error.message.includes('FCM')) {
        console.error('[FCM] Firebase-related error detected');
      }
    }

    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
