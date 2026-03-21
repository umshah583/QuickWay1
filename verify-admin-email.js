/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
/* eslint-enable @typescript-eslint/no-require-imports */

const prisma = new PrismaClient();

async function verifyAdminEmail() {
  try {
    const adminUser = await prisma.user.update({
      where: {
        email: 'admin@quickway.ae',
      },
      data: {
        emailVerified: new Date(),
      },
    });

    console.log('Admin email verified:', adminUser.email, adminUser.emailVerified);
  } catch (error) {
    console.error('Error verifying admin email:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyAdminEmail();
