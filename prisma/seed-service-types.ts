import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SERVICE_TYPES = [
  {
    key: 'car-wash',
    name: 'Car Wash',
    color: '#3B82F6', // blue-500
    sortOrder: 10,
    attributes: [
      {
        name: 'Vehicle Type',
        type: 'checkbox' as const,
        required: true,
        options: ['Saloon', '4x4 (5 Seaters)', 'SUV', 'Hatchback', 'Sedan'],
      },
      {
        name: 'Wash Type',
        type: 'select' as const,
        required: false,
        options: ['Exterior Only', 'Interior & Exterior', 'Full Detail'],
      },
    ],
  },
  {
    key: 'house-cleaning',
    name: 'House Cleaning',
    color: '#10B981', // emerald-500
    sortOrder: 20,
    attributes: [
      {
        name: 'Property Type',
        type: 'checkbox' as const,
        required: true,
        options: ['Studio', '1 Bedroom', '2 Bedrooms', '3+ Bedrooms', 'Villa'],
      },
      {
        name: 'Cleaning Type',
        type: 'select' as const,
        required: false,
        options: ['Basic Clean', 'Deep Clean', 'Move-in/Move-out'],
      },
    ],
  },
  {
    key: 'maintenance',
    name: 'Maintenance',
    color: '#F59E0B', // amber-500
    sortOrder: 30,
    attributes: [
      {
        name: 'Service Category',
        type: 'checkbox' as const,
        required: true,
        options: ['Electrical', 'Plumbing', 'HVAC', 'Carpentry', 'Painting'],
      },
      {
        name: 'Urgency',
        type: 'select' as const,
        required: false,
        options: ['Low', 'Medium', 'High', 'Emergency'],
      },
    ],
  },
];

async function seedServiceTypes() {
  console.log('🌱 Seeding service types...');

  for (const type of SERVICE_TYPES) {
    const existing = await prisma.serviceType.findFirst({
      where: { name: type.name },
    });

    if (existing) {
      await prisma.serviceType.update({
        where: { id: existing.id },
        data: {
          name: type.name,
          color: type.color,
          sortOrder: type.sortOrder,
          attributes: type.attributes,
          active: true,
        },
      });
    } else {
      await prisma.serviceType.create({
        data: {
          name: type.name,
          color: type.color,
          sortOrder: type.sortOrder,
          attributes: type.attributes,
          active: true,
        },
      });
    }
    console.log(`  ✓ Service type: ${type.name}`);
  }

  console.log('✅ Service types seeded successfully!');
}

seedServiceTypes()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
