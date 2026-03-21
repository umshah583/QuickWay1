import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkBusinessHours() {
  try {
    const businessHours = await prisma.businessHours.findFirst({
      where: { isActive: true },
    });

    console.log('Active business hours:', businessHours);

    if (!businessHours) {
      console.log('No active business hours found. Creating default business hours...');

      // Find any user to set as the creator (admin preferred)
      let userId = null;
      const adminUser = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
        select: { id: true }
      });

      if (adminUser) {
        userId = adminUser.id;
      } else {
        // Find any user
        const anyUser = await prisma.user.findFirst({
          select: { id: true }
        });
        if (anyUser) {
          userId = anyUser.id;
        } else {
          // No users exist, create a system user
          console.log('No users found. Creating system user...');
          const systemUser = await prisma.user.create({
            data: {
              id: 'system-user-' + Date.now(),
              name: 'System',
              email: 'system@quickway.com',
              role: 'ADMIN',
              emailVerified: new Date(),
              updatedAt: new Date(),
            }
          });
          userId = systemUser.id;
        }
      }

      // Create default business hours (9 AM to 6 PM)
      await prisma.businessHours.create({
        data: {
          id: 'default-business-hours',
          startTime: '09:00',
          endTime: '18:00',
          durationHours: 9,
          isActive: true,
          setById: userId,
          notes: 'Default business hours created by system',
          updatedAt: new Date(),
        }
      });

      console.log('Created default business hours: 9:00 AM - 6:00 PM');
    }
  } catch (error) {
    console.error('Error checking/creating business hours:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBusinessHours();
