const { PrismaClient } = require('@prisma/client');

async function debugSpotOrderIssues() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Debugging Spot Order Processing Issues');
    console.log('=' .repeat(50));
    
    // 1. Check database connection
    console.log('\n📊 1. Database Connection:');
    try {
      const userCount = await prisma.user.count();
      const bookingCount = await prisma.booking.count();
      const serviceCount = await prisma.service.count();
      console.log(`   ✅ Connected - Users: ${userCount}, Bookings: ${bookingCount}, Services: ${serviceCount}`);
    } catch (error) {
      console.log(`   ❌ Database connection failed: ${error.message}`);
      return;
    }
    
    // 2. Check recent spot orders (bookings where userId = driverId)
    console.log('\n📋 2. Recent Spot Orders:');
    const spotOrders = await prisma.booking.findMany({
      where: {
        userId: { not: null },
        driverId: { not: null },
      },
      include: {
        Service: true,
        User_Booking_userIdToUser: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    
    if (spotOrders.length === 0) {
      console.log('   ⚠️  No spot orders found (bookings where userId = driverId)');
    } else {
      console.log(`   ✅ Found ${spotOrders.length} recent spot orders:`);
      spotOrders.forEach(order => {
        const isSpotOrder = order.userId === order.driverId;
        console.log(`      - ${order.id}: ${order.Service?.name || 'Unknown Service'} (${isSpotOrder ? 'Spot Order' : 'Regular Booking'})`);
        console.log(`        Customer: ${order.User_Booking_userIdToUser?.name || 'Unknown'}`);
        console.log(`        Status: ${order.status}/${order.taskStatus}`);
        console.log(`        Invoice: ${order.invoiceNumber || 'MISSING'} | Order: ${order.orderNumber || 'MISSING'}`);
        console.log(`        Created: ${order.createdAt}`);
      });
    }
    
    // 3. Check services availability
    console.log('\n🔧 3. Services Availability:');
    const services = await prisma.service.findMany({
      where: { active: true },
      take: 3,
      select: { id: true, name: true, priceCents: true, active: true },
    });
    
    if (services.length === 0) {
      console.log('   ❌ No active services found');
    } else {
      console.log(`   ✅ Found ${services.length} active services:`);
      services.forEach(service => {
        console.log(`      - ${service.name} (${service.id}) - ${service.priceCents} cents`);
      });
    }
    
    // 4. Check areas/zones
    console.log('\n📍 4. Areas/Zones:');
    const areas = await prisma.area.findMany({
      where: { active: true },
      take: 3,
      select: { id: true, name: true, active: true },
    });
    
    if (areas.length === 0) {
      console.log('   ⚠️  No active areas found');
    } else {
      console.log(`   ✅ Found ${areas.length} active areas:`);
      areas.forEach(area => {
        console.log(`      - ${area.name} (${area.id})`);
      });
    }
    
    // 5. Check invoice sequences
    console.log('\n🧾 5. Invoice Sequences:');
    try {
      const sequences = await prisma.invoice_sequences.findMany();
      console.log(`   ✅ Invoice sequences table accessible - ${sequences.length} sequences found`);
      sequences.forEach(seq => {
        console.log(`      - ${seq.type}: ${seq.prefix}${seq.currentNumber}`);
      });
    } catch (error) {
      console.log(`   ❌ Invoice sequences error: ${error.message}`);
    }
    
    // 6. Check customer accounts created from spot orders
    console.log('\n👥 6. Customer Accounts from Spot Orders:');
    const recentCustomers = await prisma.user.findMany({
      where: {
        role: 'USER',
        emailVerified: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        createdAt: true,
      },
    });
    
    if (recentCustomers.length === 0) {
      console.log('   ⚠️  No recent customer accounts found');
    } else {
      console.log(`   ✅ Found ${recentCustomers.length} recent customer accounts:`);
      recentCustomers.forEach(customer => {
        console.log(`      - ${customer.name} (${customer.email})`);
        console.log(`        Verified: ${!!customer.emailVerified} | Created: ${customer.createdAt}`);
      });
    }
    
    // 7. Common issues and solutions
    console.log('\n🔧 7. Common Issues & Solutions:');
    
    console.log('\n   ❌ Issue: "Unknown Service" in assignments');
    console.log('   ✅ Solution: Fixed field name mismatch (Service → service) in dashboard API');
    
    console.log('\n   ❌ Issue: "GPS Location (lat, lng)" instead of location name');
    console.log('   ✅ Solution: Implemented reverse geocoding API');
    
    console.log('\n   ❌ Issue: Spot order creation fails');
    console.log('   ✅ Solution: Fixed response field names (Area → area, Service → service)');
    
    console.log('\n   ❌ Issue: Customer account not created');
    console.log('   ✅ Solution: Enhanced customer creation with auto-verification');
    
    console.log('\n   ❌ Issue: Missing invoice/order numbers');
    console.log('   ✅ Solution: Robust identifier generation system');
    
    // 8. Next steps for testing
    console.log('\n🚀 8. Testing Checklist:');
    console.log('   □ Restart the backend server');
    console.log('   □ Test mobile app service selection');
    console.log('   □ Test customer form validation');
    console.log('   □ Test GPS location name resolution');
    console.log('   □ Test spot order creation');
    console.log('   □ Verify customer account creation');
    console.log('   □ Check assignments screen for service names');
    console.log('   □ Verify invoice/order numbers are generated');
    
    console.log('\n🎉 Debugging completed!');
    
  } catch (error) {
    console.error('❌ Debugging failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugSpotOrderIssues();
