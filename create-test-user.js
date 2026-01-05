import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

async function createTestUser() {
  try {
    // Hash the password
    const passwordHash = bcrypt.hashSync("testpass123", 10);

    // Create the test user
    const user = await prisma.user.upsert({
      where: { email: "testuser@example.com" },
      update: {
        passwordHash,
        name: "Test User",
        phoneNumber: "+971501234567",
        role: "USER",
      },
      create: {
        email: "testuser@example.com",
        passwordHash,
        name: "Test User",
        phoneNumber: "+971501234567",
        role: "USER",
      },
    });

    console.log("✅ Test user created:", user.email);
  } catch (error) {
    console.error("❌ Error creating test user:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
