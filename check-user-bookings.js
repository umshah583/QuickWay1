const { PrismaClient } = require('@prisma/client');

async function checkUserBookings() {
  const prisma = new PrismaClient();
  
  try {
    const userId = 'cmnkwwtek0014duuqgewvv2nq';
    
    console.log('🔍 Checking user bookings for:', userId);
    
    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('👤 User Details:');
    console.log('   Name:', user.name);
    console.log('   Email:', user.email);
    console.log('   Role:', user.role);
    console.log('   Created:', user.createdAt);
    
    // Check customer bookings
    const customerBookings = await prisma.booking.count({
      where: { userId: userId }
    });
    
    console.log('\n📋 Customer Bookings:', customerBookings);
    
    // Check driver bookings (if user is a driver)
    let driverBookings = 0;
    if (user.role === 'DRIVER') {
      driverBookings = await prisma.booking.count({
        where: { driverId: userId }
      });
      console.log('🚗 Driver Bookings:', driverBookings);
    }
    
    // Get sample booking details
    if (customerBookings > 0 || driverBookings > 0) {
      console.log('\n📊 Sample Booking Details:');
      
      const sampleBookings = await prisma.booking.findMany({
        where: {
          OR: [
            { userId: userId },
            { driverId: userId }
          ]
        },
        select: {
          id: true,
          taskStatus: true,
          cashAmountCents: true,
          createdAt: true,
          userId: true,
          driverId: true
        },
        take: 5,
        orderBy: { createdAt: 'desc' }
      });
      
      sampleBookings.forEach((booking, index) => {
        console.log(`   ${index + 1}. Booking ${booking.id}`);
        console.log(`      Status: ${booking.taskStatus}`);
        console.log(`      Amount: ${booking.cashAmountCents ? booking.cashAmountCents / 100 : 0} AED`);
        console.log(`      Created: ${booking.createdAt}`);
        console.log(`      User: ${booking.userId === userId ? 'YES' : 'NO'}`);
        console.log(`      Driver: ${booking.driverId === userId ? 'YES' : 'NO'}`);
        console.log('');
      });
    }
    
    console.log('\n🔧 Recommendations:');
    if (customerBookings > 0) {
      console.log('   - User has customer bookings');
      console.log('   - Delete or reassign these bookings first');
      console.log('   - Or consider deactivating the user instead');
    }
    
    if (driverBookings > 0) {
      console.log('   - User is a driver with assigned bookings');
      console.log('   - Reassign bookings to another driver first');
      console.log('   - Or change driver role to inactive');
    }
    
    if (customerBookings === 0 && driverBookings === 0) {
      console.log('   - User has no bookings - should be safe to delete');
      console.log('   - If still failing, check for other constraints');
    }
    
  } catch (error) {
    console.error('❌ Error checking user bookings:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserBookings();
