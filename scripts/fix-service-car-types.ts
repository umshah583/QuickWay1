/**
 * Script to inspect and fix Service.carTypes based on PartnerServiceRequest.carType
 * 
 * Run with: npx ts-node scripts/fix-service-car-types.ts
 * 
 * This script:
 * 1. Lists all approved partner service requests and their linked services
 * 2. Shows which services have empty carTypes arrays
 * 3. Optionally fixes them by copying carType from the request to the service's carTypes array
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Inspecting Partner Service Requests and Services ===\n');

  // Get all approved partner service requests with their linked services
  const requests = await prisma.partnerServiceRequest.findMany({
    where: {
      status: 'APPROVED',
    },
    include: {
      service: true,
      partner: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(`Found ${requests.length} approved partner service requests\n`);

  const servicesToFix: Array<{
    serviceId: string;
    serviceName: string;
    requestCarType: string;
    currentCarTypes: string[];
  }> = [];

  for (const request of requests) {
    const serviceCarTypes = (request.service?.carTypes ?? []) as string[];
    const requestCarType = request.carType;

    console.log(`Request ID: ${request.id}`);
    console.log(`  Partner: ${request.partner?.name ?? 'Unknown'}`);
    console.log(`  Service Name: ${request.service?.name ?? request.name}`);
    console.log(`  Request carType: "${requestCarType}"`);
    console.log(`  Service carTypes: [${serviceCarTypes.map(t => `"${t}"`).join(', ')}]`);
    console.log(`  Service active: ${request.service?.active ?? 'N/A'}`);
    console.log(`  Service serviceTypeId: ${(request.service as any)?.serviceTypeId ?? 'N/A'}`);

    if (request.service && serviceCarTypes.length === 0 && requestCarType) {
      console.log(`  ⚠️  NEEDS FIX: Service has empty carTypes, should include "${requestCarType}"`);
      servicesToFix.push({
        serviceId: request.service.id,
        serviceName: request.service.name,
        requestCarType,
        currentCarTypes: serviceCarTypes,
      });
    } else if (request.service && requestCarType && !serviceCarTypes.includes(requestCarType)) {
      console.log(`  ⚠️  MISSING: Service carTypes doesn't include "${requestCarType}"`);
      servicesToFix.push({
        serviceId: request.service.id,
        serviceName: request.service.name,
        requestCarType,
        currentCarTypes: serviceCarTypes,
      });
    } else {
      console.log(`  ✓ OK`);
    }
    console.log('');
  }

  console.log('=== Summary ===\n');
  console.log(`Total approved requests: ${requests.length}`);
  console.log(`Services needing fix: ${servicesToFix.length}`);

  if (servicesToFix.length > 0) {
    console.log('\nServices to fix:');
    for (const service of servicesToFix) {
      console.log(`  - ${service.serviceName} (ID: ${service.serviceId}): add "${service.requestCarType}"`);
    }

    // Uncomment the following block to actually fix the data
    console.log('\n=== Applying Fixes ===\n');
    for (const service of servicesToFix) {
      const newCarTypes = [...service.currentCarTypes];
      if (!newCarTypes.includes(service.requestCarType)) {
        newCarTypes.push(service.requestCarType);
      }

      await prisma.service.update({
        where: { id: service.serviceId },
        data: { carTypes: newCarTypes },
      });

      console.log(`✓ Updated ${service.serviceName}: carTypes = [${newCarTypes.map(t => `"${t}"`).join(', ')}]`);
    }
    console.log('\nDone! All services have been fixed.');
  } else {
    console.log('\nNo fixes needed.');
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
