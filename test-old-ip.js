// Test the old IP address to see if it was working
async function testOldIP() {
  try {
    console.log('Testing old IP (10.125.32.126:3000)...');
    
    const response = await fetch('http://10.125.32.126:3000/api/driver/dashboard', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log(`Response status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Old IP API is working!');
    } else {
      const errorText = await response.text();
      console.log('❌ Old IP API failed:', response.status);
      console.log('Error:', errorText);
    }

  } catch (error) {
    console.error('❌ Old IP network error:', error.message);
  }
}

testOldIP();
