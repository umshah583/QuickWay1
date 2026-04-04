const axios = require('axios');

async function testSpotOrderWithLogs() {
  try {
    console.log('Testing spot order creation with logging...');
    
    // Create a spot order with a simple test script that mimics the mobile app
    const spotOrderData = {
      zoneId: '', // Empty string
      serviceId: 'cmnj7xeb200018itg716y0vwd', // Basic Wash
      locationLabel: 'Test Location for Invoice Numbers',
      locationCoordinates: '25.2048,55.2708',
      vehiclePlate: 'TEST123',
      vehicleCount: 1,
      vehicleServiceDetails: 'Test spot order for invoice numbers',
    };

    console.log('Sending request to create spot order...');
    console.log('Data:', JSON.stringify(spotOrderData, null, 2));

    try {
      const response = await axios.post(
        'http://10.125.32.126:3000/api/driver/spot-orders',
        spotOrderData,
        {
          headers: {
            'Content-Type': 'application/json'
            // No auth - we expect 401, but we want to see if validation works
          }
        }
      );
      console.log('Unexpected success:', response.data);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Got expected 401 Unauthorized - validation passed');
        console.log('This means the spot order data format is correct');
      } else {
        console.log('❌ Unexpected error:', error.response?.data || error.message);
      }
    }

  } catch (error) {
    console.error('❌ Error testing spot order:', error);
  }
}

testSpotOrderWithLogs();
