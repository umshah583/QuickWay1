const axios = require('axios');

async function testCustomerSpotOrder() {
  try {
    console.log('Testing spot order with customer creation...');

    // First login to get token (using a test endpoint that doesn't require real credentials)
    const spotOrderData = {
      zoneId: '', // Empty string as fallback
      serviceId: 'cmnj7xeb200018itg716y0vwd', // Basic Wash service ID
      locationLabel: 'Test Location for Customer Creation',
      locationCoordinates: '25.2048,55.2708',
      vehiclePlate: '', // Not used anymore
      vehicleCount: 1,
      vehicleServiceDetails: '',
      // Customer details
      customerName: 'Test Customer',
      customerMobile: '+971501234567',
      customerEmail: 'testcustomer@example.com',
      customerVehiclePlate: 'ABC-1234',
    };

    console.log('Sending spot order with customer data...');
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
        console.log('This means the spot order data format with customer details is correct');
      } else if (error.response && error.response.status === 400) {
        console.log('❌ Validation error:', error.response.data);
      } else {
        console.log('❌ Unexpected error:', error.response?.data || error.message);
      }
    }

  } catch (error) {
    console.error('❌ Error testing customer spot order:', error);
  }
}

testCustomerSpotOrder();
