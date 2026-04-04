const axios = require('axios');

async function testSpotOrderAPI() {
  try {
    console.log('Testing spot order API endpoint without auth...');

    // Test the exact data format the mobile app will send
    const spotOrderData = {
      zoneId: '', // Empty string as fallback
      serviceId: 'cmnj7xeb200018itg716y0vwd', // Basic Wash service ID
      locationLabel: 'GPS Location (25.2048, 55.2708)',
      locationCoordinates: '25.2048,55.2708',
      vehiclePlate: '',
      vehicleCount: 1,
      vehicleServiceDetails: '',
    };

    console.log('Sending spot order data:', spotOrderData);

    const response = await axios.post(
      'http://10.125.32.126:3000/api/driver/spot-orders',
      spotOrderData,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Spot order created successfully!');
    console.log('Response:', response.data);

  } catch (error) {
    console.error('❌ Error testing spot order API:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Message:', error.message);
    }
  }
}

testSpotOrderAPI();
