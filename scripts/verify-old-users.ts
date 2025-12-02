import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyOldUsers() {
  try {
    // Get all unverified users
    const unverifiedUsers = await prisma.user.findMany({
      where: {
        emailVerified: null,
      },
    });

    console.log(`\nFound ${unverifiedUsers.length} unverified users.\n`);

    if (unverifiedUsers.length === 0) {
      console.log('✓ All users are already verified!');
      return;
    }

    // Update each user individually
    let count = 0;
    for (const user of unverifiedUsers) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: new Date(),
        },
      });
      console.log(`✓ Verified: ${user.email || user.name || user.id}`);
      count++;
    }

    console.log(`\n✓ Successfully verified ${count} users!`);
    console.log('These users can now sign in without email verification.\n');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyOldUsers();
