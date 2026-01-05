import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function getArgValue(name: string) {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find((value) => value.startsWith(prefix));
  if (arg) {
    return arg.slice(prefix.length).trim();
  }
  return undefined;
}

async function createAdminUser() {
  const email =
    getArgValue("email") ??
    process.env.ADMIN_EMAIL ??
    (() => {
      throw new Error("Missing admin email. Pass --email=<email> or set ADMIN_EMAIL env.");
    })();

  const password =
    getArgValue("password") ??
    process.env.ADMIN_PASSWORD ??
    (() => {
      throw new Error("Missing admin password. Pass --password=<password> or set ADMIN_PASSWORD env.");
    })();

  const name = getArgValue("name") ?? process.env.ADMIN_NAME ?? "Admin User";

  const hashedPassword = await bcrypt.hash(password, 10);
  const now = new Date();

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: hashedPassword,
      role: "ADMIN",
      emailVerified: now,
      name,
    },
    create: {
      email,
      passwordHash: hashedPassword,
      name,
      role: "ADMIN",
      emailVerified: now,
    },
  });

  console.log("✅ Admin user created/updated:");
  console.log(`   Email: ${user.email}`);
  console.log(`   Name: ${user.name}`);
  console.log(`   Role: ${user.role}`);
  console.log(`   Email verified at: ${user.emailVerified?.toISOString()}`);
}

createAdminUser()
  .catch((error) => {
    console.error("❌ Failed to create admin user:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
