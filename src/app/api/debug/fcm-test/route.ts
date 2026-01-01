import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { pilotMessaging, customerMessaging } from '@/lib/firebaseAdmin';

export async function GET() {
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    checks: {},
  };
  
  // Type assertion for the checks object to allow property assignment
  const checks = diagnostics.checks as Record<string, unknown>;

  // Check 1: Firebase Admin SDK initialized (both apps)
  checks.firebaseAdmin = {
    pilotApp: {
      initialized: !!pilotMessaging,
      status: pilotMessaging ? 'OK' : 'NOT INITIALIZED'
    },
    customerApp: {
      initialized: !!customerMessaging,
      status: customerMessaging ? 'OK' : 'NOT INITIALIZED'
    }
  };

  // Check 2: Environment variables
  checks.serviceAccountEnv = {
    pilot: {
      set: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_PILOT,
      value: process.env.GOOGLE_APPLICATION_CREDENTIALS_PILOT || 'NOT SET'
    },
    customer: {
      set: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_CUSTOMER,
      value: process.env.GOOGLE_APPLICATION_CREDENTIALS_CUSTOMER || 'NOT SET'
    }
  };

  // Check 3: Get users with FCM tokens (drivers)
  try {
    const driversWithTokens = await prisma.user.findMany({
      where: { 
        role: 'DRIVER',
        fcmToken: { not: null }
      },
      select: { id: true, name: true, email: true, fcmToken: true }
    });
    
    checks.driversWithFCMTokens = {
      count: driversWithTokens.length,
      drivers: driversWithTokens.map(d => ({
        id: d.id,
        name: d.name,
        email: d.email,
        tokenPreview: d.fcmToken ? d.fcmToken.substring(0, 30) + '...' : null
      }))
    };
  } catch (error) {
    checks.driversWithFCMTokens = {
      error: error instanceof Error ? error.message : String(error)
    };
  }

  // Check 4: Try to send test FCM messages to both driver and customer
  checks.fcmSend = { driver: {}, customer: {} };

  // Type assertion for fcmSend to allow property assignment
  const fcmSend = checks.fcmSend as { driver: Record<string, unknown>; customer: Record<string, unknown> };
  
  // Test driver (Pilot app)
  if (pilotMessaging) {
    try {
      const testDriver = await prisma.user.findFirst({
        where: { role: 'DRIVER', fcmToken: { not: null } },
        select: { id: true, name: true, fcmToken: true }
      });

      if (testDriver?.fcmToken) {
        console.log(`[FCM-TEST] Sending test to driver ${testDriver.name}...`);
        const message = {
          token: testDriver.fcmToken,
          notification: { title: 'Pilot Test', body: `Test at ${new Date().toISOString()}` },
          data: { title: 'Pilot Test', body: 'Test notification', type: 'test' },
          android: { priority: 'high' as const, notification: { channelId: 'default_channel', priority: 'high' as const } }
        };
        const result = await pilotMessaging.send(message);
        fcmSend.driver = { status: 'SUCCESS', messageId: result, sentTo: testDriver.name };
        console.log(`[FCM-TEST] ✅ Driver message sent! ID: ${result}`);
      } else {
        fcmSend.driver = { status: 'SKIPPED', reason: 'No driver with FCM token' };
      }
    } catch (error) {
      fcmSend.driver = { status: 'FAILED', error: error instanceof Error ? error.message : String(error) };
    }
  } else {
    fcmSend.driver = { status: 'SKIPPED', reason: 'Pilot Firebase not initialized' };
  }

  // Test customer (Quick app)
  if (customerMessaging) {
    try {
      const testCustomer = await prisma.user.findFirst({
        where: { role: 'USER', fcmToken: { not: null } },
        select: { id: true, name: true, fcmToken: true }
      });

      if (testCustomer?.fcmToken) {
        console.log(`[FCM-TEST] Sending test to customer ${testCustomer.name}...`);
        const message = {
          token: testCustomer.fcmToken,
          notification: { title: 'Quick Test', body: `Test at ${new Date().toISOString()}` },
          data: { title: 'Quick Test', body: 'Test notification', type: 'test' },
          android: { priority: 'high' as const, notification: { channelId: 'default_channel', priority: 'high' as const } }
        };
        const result = await customerMessaging.send(message);
        fcmSend.customer = { status: 'SUCCESS', messageId: result, sentTo: testCustomer.name };
        console.log(`[FCM-TEST] ✅ Customer message sent! ID: ${result}`);
      } else {
        fcmSend.customer = { status: 'SKIPPED', reason: 'No customer with FCM token' };
      }
    } catch (error) {
      fcmSend.customer = { status: 'FAILED', error: error instanceof Error ? error.message : String(error) };
    }
  } else {
    fcmSend.customer = { status: 'SKIPPED', reason: 'Customer Firebase not initialized' };
  }

  return NextResponse.json(diagnostics, { status: 200 });
}
