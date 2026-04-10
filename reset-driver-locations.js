const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log('Resetting driver locations to use actual GPS...');
  
  // Reset all driver locations to null so they will use actual GPS from device
  const result = await prisma.user.updateMany({
    where: {
      role: 'DRIVER',
    },
    data: {
      currentLatitude: null,
      currentLongitude: null,
      locationUpdatedAt: null,
    },
  });
  
  console.log(`Reset ${result.count} driver locations`);
  console.log('Drivers will now send actual GPS coordinates when they log in');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
