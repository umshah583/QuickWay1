import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateFCMTokens() {
  console.log('Starting FCM token migration...');

  try {
    // Find all users with old fcmToken field
    const usersWithOldTokens = await prisma.user.findMany({
      where: {
        fcmToken: { not: null }
      },
      select: {
        id: true,
        name: true,
        fcmToken: true,
        role: true
      }
    });

    console.log(`Found ${usersWithOldTokens.length} users with old FCM tokens`);

    for (const user of usersWithOldTokens) {
      // Determine appType based on role
      const appType = user.role === 'DRIVER' ? 'DRIVER' : 'CUSTOMER';

      // Check if FCMToken record already exists
      const existingToken = await prisma.fCMToken.findFirst({
        where: {
          userId: user.id,
          appType: appType as 'CUSTOMER' | 'DRIVER',
          platform: 'android' // Assume android as default
        }
      });

      if (!existingToken) {
        // Create new FCMToken record
        await prisma.fCMToken.create({
          data: {
            userId: user.id,
            token: user.fcmToken!,
            appType: appType as 'CUSTOMER' | 'DRIVER',
            platform: 'android' // Assume android as default
          }
        });
        console.log(`Migrated FCM token for user ${user.name} (${user.id})`);
      } else {
        console.log(`FCM token already exists for user ${user.name} (${user.id})`);
      }
    }

    console.log('FCM token migration completed');
  } catch (error) {
    console.error('Error during FCM token migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateFCMTokens();
