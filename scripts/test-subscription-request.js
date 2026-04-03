const http = require('http');

function testSubscriptionRequestCreation() {
  console.log('🔍 Testing Subscription Request Creation...\n');
  console.log('='.repeat(50));

  const testData = {
    userId: "test-user-123",
    packageId: "pkg-1775244043630", // Use a real package ID from previous logs
    scheduleDates: ["2025-01-01"],
    vehicleMake: "Toyota",
    vehicleModel: "Camry",
    vehicleColor: "Blue",
    vehiclePlate: "ABC-1234"
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
    timeout: 10000
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
      
      try {
        const parsedData = JSON.parse(data);
        if (res.statusCode === 200) {
          console.log('\n✅ SUCCESS: Subscription request created successfully');
          console.log('📋 Request ID:', parsedData.requestId);
          console.log('📋 Status:', parsedData.status);
        } else {
          console.log('\n❌ ERROR: Failed to create subscription request');
          console.log('🔍 Error:', parsedData.error);
        }
      } catch (parseError) {
        console.log('\n❌ PARSE ERROR: Could not parse response');
        console.log('🔍 Raw Response:', data);
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

// Test with invalid data to see validation
function testInvalidRequest() {
  console.log('\n\n🔍 Testing Invalid Request (should fail)...\n');
  console.log('='.repeat(50));

  const invalidData = {
    // Missing required fields
    userId: "",
    packageId: ""
  };

  const postData = JSON.stringify(invalidData);
  console.log('📤 Invalid Data:', postData);

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

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log(`📥 Response Body:`, data);
      
      try {
        const parsedData = JSON.parse(data);
        if (res.statusCode === 400) {
          console.log('✅ EXPECTED: Invalid request properly rejected');
        } else {
          console.log('⚠️  UNEXPECTED: Should have returned 400 for invalid data');
        }
      } catch (parseError) {
        console.log('❌ PARSE ERROR:', parseError.message);
      }
    });
  });

  req.on('error', (error) => {
    console.log('\n❌ REQUEST ERROR:', error.message);
  });

  req.write(postData);
  req.end();
}

async function main() {
  try {
    testSubscriptionRequestCreation();
    setTimeout(testInvalidRequest, 2000);
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testSubscriptionRequestCreation, testInvalidRequest };
