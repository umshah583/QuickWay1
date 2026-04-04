const axios = require('axios');

async function testMobileSpotOrder() {
  try {
    console.log('Testing mobile app spot order creation...');

    // First, get a driver token using the driver login endpoint
    const loginResponse = await axios.post('http://10.125.32.126:3000/api/driver/login', {
      email: 'aslam1@gmail.com',
      password: 'password123' // Replace with actual password
    });

    const token = loginResponse.data.token;
    console.log('✅ Got driver auth token');

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
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Mobile spot order created successfully!');
    console.log('Response:', response.data);

  } catch (error) {
    console.error('❌ Error testing mobile spot order:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Message:', error.message);
    }
  }
}

testMobileSpotOrder();
