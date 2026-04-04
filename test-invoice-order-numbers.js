const axios = require('axios');

async function testInvoiceOrderNumbers() {
  try {
    console.log('Testing spot order invoice and order number generation...');

    // First login to get token
    const loginResponse = await axios.post('http://10.125.32.126:3000/api/driver/login', {
      email: 'aslam1@gmail.com',
      password: 'password123'
    });

    const token = loginResponse.data.token;
    console.log('✅ Got driver auth token');

    // Create a spot order
    const spotOrderData = {
      zoneId: '', // Empty string as fallback
      serviceId: 'cmnj7xeb200018itg716y0vwd', // Basic Wash service ID
      locationLabel: 'GPS Location (25.2048, 55.2708)',
      locationCoordinates: '25.2048,55.2708',
      vehiclePlate: '',
      vehicleCount: 1,
      vehicleServiceDetails: '',
    };

    console.log('Creating spot order...');
    const response = await axios.post(
      'http://10.125.32.126:3000/api/driver/spot-orders',
      spotOrderData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Spot order created successfully!');
    console.log('Response data:');
    console.log('- ID:', response.data.id);
    console.log('- Invoice Number:', response.data.invoiceNumber || '❌ MISSING');
    console.log('- Order Number:', response.data.orderNumber || '❌ MISSING');
    console.log('- Service:', response.data.Service?.name || 'Unknown');
    console.log('- Status:', response.data.status);
    console.log('- Driver ID:', response.data.driverId);
    console.log('- User ID:', response.data.userId);

    if (response.data.invoiceNumber && response.data.orderNumber) {
      console.log('🎉 SUCCESS: Invoice and order numbers are generated correctly!');
    } else {
      console.log('❌ ISSUE: Missing invoice or order number');
    }

  } catch (error) {
    console.error('❌ Error testing invoice/order numbers:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Message:', error.message);
    }
  }
}

testInvoiceOrderNumbers();
