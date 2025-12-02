import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    console.log(`\nTotal users found: ${allUsers.length}\n`);

    if (allUsers.length === 0) {
      console.log('No users in database.');
      return;
    }

    allUsers.forEach((user, index) => {
      const verified = user.emailVerified ? '✓ Verified' : '✗ Not verified';
      console.log(`${index + 1}. ${user.email || 'No email'}`);
      console.log(`   Name: ${user.name || 'N/A'}`);
      console.log(`   Status: ${verified}`);
      console.log(`   Created: ${user.createdAt.toLocaleString()}`);
      console.log('');
    });

    const unverifiedCount = allUsers.filter(u => !u.emailVerified).length;
    const verifiedCount = allUsers.filter(u => u.emailVerified).length;

    console.log(`Summary: ${verifiedCount} verified, ${unverifiedCount} unverified\n`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
