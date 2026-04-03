const http = require('http');

function testSimpleRequest() {
  console.log('🔍 Simple Subscription Request Test...\n');
  console.log('='.repeat(50));

  // Test with a minimal valid request to see what error we get
  const testData = {
    userId: "admin",  // Try with admin user ID
    packageId: "pkg-test",  // Try with a simple package ID
    scheduleDates: ["2025-01-01"]
  };

  const postData = JSON.stringify(testData);
  console.log('📤 Test Data:', postData);

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/subscription-requests',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    },
    timeout: 5000
  };

  const req = http.request(options, (res) => {
    let data = '';
    console.log(`\n📥 Response Status: ${res.statusCode}`);
    console.log(`📥 Response Headers:`, res.headers);

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log(`📥 Response Body:`, data);
      
      if (res.statusCode === 500) {
        console.log('\n💡 This is a server error - check server logs for details');
        console.log('💡 The issue is likely:');
        console.log('   1. User does not exist in database');
        console.log('   2. Package does not exist in database');
        console.log('   3. Database schema issue');
        console.log('   4. Missing required fields');
      }
    });
  });

  req.on('error', (error) => {
    console.log('\n❌ REQUEST ERROR:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure the Next.js server is running on port 3000');
    }
  });

  req.on('timeout', () => {
    req.destroy();
    console.log('\n❌ TIMEOUT: Request took too long');
  });

  req.write(postData);
  req.end();
}

// Also test the GET endpoint to see if it works
function testGetRequests() {
  console.log('\n\n🔍 Testing GET Subscription Requests...\n');
  console.log('='.repeat(50));

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/subscription-requests?userId=test',
    method: 'GET',
    timeout: 5000
  };

  const req = http.request(options, (res) => {
    let data = '';
    console.log(`📥 Response Status: ${res.statusCode}`);

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log(`📥 Response Body:`, data);
    });
  });

  req.on('error', (error) => {
    console.log('\n❌ REQUEST ERROR:', error.message);
  });

  req.end();
}

async function main() {
  try {
    testSimpleRequest();
    setTimeout(testGetRequests, 2000);
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testSimpleRequest, testGetRequests };
