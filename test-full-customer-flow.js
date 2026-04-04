const { PrismaClient } = require('@prisma/client');

async function testFullCustomerFlow() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Testing full customer creation flow...');
    
    // 1. Check if test customer already exists
    const testEmail = 'testcustomer@example.com';
    const existingCustomer = await prisma.user.findFirst({
      where: {
        OR: [
          { email: testEmail },
          { phoneNumber: '+971501234567' }
        ]
      }
    });

    if (existingCustomer) {
      console.log('✅ Customer already exists:', existingCustomer.email);
      console.log('   - ID:', existingCustomer.id);
      console.log('   - Name:', existingCustomer.name);
      console.log('   - Email Verified:', existingCustomer.emailVerified);
      console.log('   - Role:', existingCustomer.role);
      console.log('   - Active:', existingCustomer.isActive);
    } else {
      console.log('❌ Customer does not exist yet - will be created when spot order is made');
    }

    // 2. Check recent bookings for this customer
    const recentBookings = await prisma.booking.findMany({
      where: {
        User_Booking_userIdToUser: {
          email: testEmail
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 3,
      select: {
        id: true,
        invoiceNumber: true,
        orderNumber: true,
        status: true,
        taskStatus: true,
        createdAt: true,
        Service: {
          select: {
            name: true
          }
        },
        User_Booking_userIdToUser: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    console.log('\n📊 Recent bookings for test customer:');
    if (recentBookings.length === 0) {
      console.log('   No bookings found for test customer');
    } else {
      recentBookings.forEach((booking, index) => {
        console.log(`   ${index + 1}. ${booking.Service?.name} - ${booking.id}`);
        console.log(`      Status: ${booking.status}/${booking.taskStatus}`);
        console.log(`      Invoice: ${booking.invoiceNumber || '❌ MISSING'}`);
        console.log(`      Order: ${booking.orderNumber || '❌ MISSING'}`);
        console.log(`      Customer: ${booking.User_Booking_userIdToUser?.name}`);
        console.log('');
      });
    }

    // 3. Test password generation function
    function generateRandomPassword(length = 8) {
      const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
      let password = '';
      for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
      }
      return password;
    }

    console.log('🔐 Testing password generation:');
    for (let i = 0; i < 3; i++) {
      const password = generateRandomPassword();
      console.log(`   Generated: ${password} (length: ${password.length})`);
    }

    console.log('\n✅ Full customer flow test completed!');
    console.log('📱 Next steps:');
    console.log('   1. Restart server to pick up code changes');
    console.log('   2. Test mobile app with customer details');
    console.log('   3. Verify customer account creation');
    console.log('   4. Implement email sending for credentials');

  } catch (error) {
    console.error('❌ Error testing customer flow:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFullCustomerFlow();
