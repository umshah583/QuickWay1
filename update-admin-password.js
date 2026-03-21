/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
/* eslint-enable @typescript-eslint/no-require-imports */

const prisma = new PrismaClient();

async function updateAdminPassword() {
  try {
    const hash = await bcrypt.hash('admin123', 12);
    await prisma.user.update({
      where: {
        email: 'admin@quickway.ae',
      },
      data: {
        passwordHash: hash,
      },
    });

    console.log('Admin password updated. Hash starts with:', hash.substring(0, 10));
  } catch (error) {
    console.error('Error updating admin password:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateAdminPassword();
