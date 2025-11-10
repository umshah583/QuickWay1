/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.service.count();
  if (count === 0) {
    await prisma.service.createMany({
      data: [
        {
          name: "Basic Wash",
          description: "Exterior wash and dry",
          durationMin: 30,
          priceCents: 1500,
          active: true,
        },
        {
          name: "Premium Wash",
          description: "Exterior + interior vacuum and wipe",
          durationMin: 60,
          priceCents: 3500,
          active: true,
        },
        {
          name: "Interior Deep Clean",
          description: "Detailed interior cleaning",
          durationMin: 90,
          priceCents: 6000,
          active: true,
        },
      ],
    });
    console.log("Seeded default services");
  } else {
    console.log(`Services already present: ${count}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
