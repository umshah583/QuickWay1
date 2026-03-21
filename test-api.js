// Test script to check live tracking API
const testLiveTracking = async () => {
  try {
    console.log('Testing live tracking API...');

    const response = await fetch('http://localhost:3000/api/live-tracking', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.log('API call failed:', response.status, response.statusText);
      return;
    }

    const data = await response.json();
    console.log('API Response:');
    console.log(JSON.stringify(data, null, 2));

    console.log('Summary:');
    console.log(`- Total drivers: ${data.drivers?.length || 0}`);
    console.log(`- Drivers with location: ${data.drivers?.filter(d => d.location).length || 0}`);
    console.log(`- Drivers without location: ${data.drivers?.filter(d => !d.location).length || 0}`);

    if (data.drivers) {
      console.log('Driver details:');
      data.drivers.forEach(driver => {
        console.log(`  - ${driver.driverName}: ${driver.availabilityStatus}, Location: ${driver.location ? 'YES' : 'NO'}`);
      });
    }

  } catch (error) {
    console.error('Error testing API:', error);
  }
};

testLiveTracking();
