/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
/* eslint-enable @typescript-eslint/no-require-imports */

const prisma = new PrismaClient();

async function addAdminUser() {
  try {
    const adminUser = await prisma.user.create({
      data: {
        name: 'Admin User',
        email: 'admin@quickway.ae',
        passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/Lew3H0xHFuPJlB0Si', // password: admin123
        role: 'ADMIN',
      },
    });

    console.log('Admin user created:', adminUser);
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addAdminUser();
