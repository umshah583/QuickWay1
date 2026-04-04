// Test if the API is accessible from localhost
async function testLocalhostAPI() {
  try {
    console.log('Testing localhost API...');
    
    const response = await fetch('http://localhost:3000/api/driver/dashboard', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log(`Response status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Localhost API is working!');
      console.log('Response structure:', Object.keys(data));
    } else {
      const errorText = await response.text();
      console.log('❌ Localhost API failed:', response.status);
      console.log('Error:', errorText);
    }

  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

testLocalhostAPI();
