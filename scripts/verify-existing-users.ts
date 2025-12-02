import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyExistingUsers() {
  try {
    // Find all users with null emailVerified (created before verification feature)
    const unverifiedUsers = await prisma.user.findMany({
      where: {
        emailVerified: null,
        email: { not: null },
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    console.log(`Found ${unverifiedUsers.length} users without email verification.`);

    if (unverifiedUsers.length === 0) {
      console.log('✓ All users are already verified!');
      return;
    }

    // Mark them as verified with current timestamp
    const result = await prisma.user.updateMany({
      where: {
        emailVerified: null,
        email: { not: null },
      },
      data: {
        emailVerified: new Date(),
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    console.log(`✓ Successfully verified ${result.count} existing users.`);
    console.log('\nVerified users:');
    unverifiedUsers.forEach((user) => {
      console.log(`  - ${user.email} (${user.name || 'No name'})`);
    });
  } catch (error) {
    console.error('Error verifying users:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyExistingUsers();
