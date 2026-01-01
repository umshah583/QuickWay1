import { prisma } from '@/lib/prisma';
import { sendToUser } from '@/lib/notifications-v2';

export async function GET() {
  console.log('[DEBUG-FCM] ========== DEBUG NOTIFICATIONS V2 TEST ==========');

  try {
    // Get all users with FCM tokens
    const usersWithTokens = await prisma.user.findMany({
      where: { fcmToken: { not: null } },
      select: { id: true, name: true, fcmToken: true, role: true },
      take: 5
    });

    console.log(`[DEBUG-FCM] Found ${usersWithTokens.length} users with FCM tokens`);

    const results = [];

    // Send test notification to each user using notifications-v2
    for (const user of usersWithTokens) {
      console.log(`[DEBUG-FCM] Sending test notifications to ${user.name} (${user.id})`);
      try {
        // Determine appType based on role
        const appType = user.role === 'DRIVER' ? 'DRIVER' : 'CUSTOMER';
        
        // Send notification using V2 system
        await sendToUser(user.id, appType, {
          title: `DEBUG: Test for ${user.name}`,
          body: `This is a debug notification sent at ${new Date().toISOString()}`,
          category: 'SYSTEM',
        });

        results.push({ user: user.name, appType, status: 'SENT' });
        console.log(`[DEBUG-FCM] ✅ V2 notification sent to ${user.name} as ${appType}`);
      } catch (error) {
        results.push({ user: user.name, status: 'FAILED', error: error instanceof Error ? error.message : String(error) });
        console.error(`[DEBUG-FCM] ❌ Failed to send to ${user.name}:`, error);
      }
    }

    console.log('[DEBUG-FCM] ========== DEBUG NOTIFICATIONS V2 TEST COMPLETE ==========');

    return new Response(`
<!DOCTYPE html>
<html>
<head>
    <title>Notifications V2 Debug Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .success { color: green; }
        .error { color: red; }
        .result { margin: 10px 0; padding: 10px; border: 1px solid #ccc; }
    </style>
</head>
<body>
    <h1>Notifications V2 Debug Test Results</h1>
    <p><strong>Test Time:</strong> ${new Date().toISOString()}</p>
    <p><strong>Users with FCM tokens found:</strong> ${usersWithTokens.length}</p>

    <h2>Test Results:</h2>
    ${results.map(result => `
    <div class="result">
        <strong>${result.user}:</strong>
        <span class="${result.status === 'SENT' ? 'success' : 'error'}">${result.status}</span>
        ${result.error ? `<br><em>Error: ${result.error}</em>` : ''}
    </div>
    `).join('')}

    <h2>Notifications V2 Info:</h2>
    <ul>
        <li><strong>System:</strong> Using notifications-v2 with appType isolation</li>
        <li><strong>CUSTOMER:</strong> Notifications go to customer app only</li>
        <li><strong>DRIVER:</strong> Notifications go to driver app only</li>
    </ul>

    <button onclick="location.reload()">Run Test Again</button>
</body>
</html>
    `, {
      headers: { 'Content-Type': 'text/html' },
    });

  } catch (error) {
    console.error('[DEBUG-FCM] ❌ Debug error:', error);
    return new Response(`
<!DOCTYPE html>
<html>
<head><title>Notifications V2 Debug Error</title></head>
<body>
    <h1>Error</h1>
    <p>${error instanceof Error ? error.message : String(error)}</p>
</body>
</html>
    `, {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
