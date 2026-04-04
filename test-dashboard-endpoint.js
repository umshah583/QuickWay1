// Test the actual dashboard API endpoint
async function testDashboardEndpoint() {
  try {
    console.log('Testing dashboard API endpoint...');
    
    // First, we need to get a driver token. Let's create a simple login test
    const loginResponse = await fetch('http://localhost:3000/api/driver/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'aslam@gmail.com',
        password: 'password123' // You might need to use the actual password
      })
    });

    if (!loginResponse.ok) {
      console.log('❌ Login failed:', await loginResponse.text());
      return;
    }

    const loginData = await loginResponse.json();
    console.log('✅ Login successful');
    
    if (!loginData.token) {
      console.log('❌ No token received');
      return;
    }

    // Now test the dashboard endpoint
    const dashboardResponse = await fetch('http://localhost:3000/api/driver/dashboard', {
      headers: {
        'Authorization': `Bearer ${loginData.token}`,
        'Content-Type': 'application/json',
      }
    });

    if (!dashboardResponse.ok) {
      console.log('❌ Dashboard API failed:', await dashboardResponse.text());
      return;
    }

    const dashboardData = await dashboardResponse.json();
    console.log('✅ Dashboard API successful');
    console.log('Response:', JSON.stringify(dashboardData, null, 2));

  } catch (error) {
    console.error('❌ Error testing dashboard endpoint:', error.message);
  }
}

testDashboardEndpoint();
