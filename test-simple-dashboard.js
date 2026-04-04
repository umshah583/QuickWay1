// Simple test to check if the dashboard API is accessible
async function testDashboardAPI() {
  try {
    console.log('Testing dashboard API endpoint...');
    
    const response = await fetch('http://localhost:3000/api/driver/dashboard', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log(`Response status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Dashboard API is working!');
      console.log('Response structure:', Object.keys(data));
      
      if (data.data && data.data.spotOrders) {
        console.log(`✅ Found ${data.data.spotOrders.length} spot orders`);
      } else {
        console.log('❌ No spotOrders field in response');
        console.log('Data keys:', data.data ? Object.keys(data.data) : 'No data field');
      }
    } else {
      const errorText = await response.text();
      console.log('❌ Dashboard API failed:', response.status);
      console.log('Error:', errorText);
    }

  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

testDashboardAPI();
