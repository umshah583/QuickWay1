const http = require('http');

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, data: null, raw: data });
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function debugSubscriptionRequest() {
  console.log('🔍 Debugging Subscription Request Creation...\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Check if there are any users in the database
    console.log('📋 Step 1: Checking existing users...');
    const usersResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/users',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000
    });
    
    console.log('Users API Status:', usersResponse.status);
    if (usersResponse.status === 200) {
      console.log('✅ Users found:', usersResponse.data?.length || 0);
      if (usersResponse.data?.length > 0) {
        const firstUser = usersResponse.data[0];
        console.log('📤 Using user:', firstUser.email || firstUser.id);
        
        // Step 2: Check available packages
        console.log('\n📋 Step 2: Checking available packages...');
        const packagesResponse = await makeRequest({
          hostname: 'localhost',
          port: 3000,
          path: '/api/packages',
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000
        });
        
        console.log('Packages API Status:', packagesResponse.status);
        if (packagesResponse.status === 200) {
          console.log('✅ Packages found:', packagesResponse.data?.data?.length || 0);
          if (packagesResponse.data?.data?.length > 0) {
            const firstPackage = packagesResponse.data.data[0];
            console.log('📦 Using package:', firstPackage.name, 'ID:', firstPackage.id);
            
            // Step 3: Try to create subscription request with real data
            console.log('\n📋 Step 3: Creating subscription request with real data...');
            const requestData = {
              userId: firstUser.id,
              packageId: firstPackage.id,
              scheduleDates: ["2025-01-15"],
              vehicleMake: "Toyota",
              vehicleModel: "Camry",
              vehicleColor: "Blue",
              vehiclePlate: "TEST-1234"
            };
            
            console.log('📤 Request Data:', JSON.stringify(requestData, null, 2));
            
            const createResponse = await makeRequest({
              hostname: 'localhost',
              port: 3000,
              path: '/api/subscription-requests',
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(JSON.stringify(requestData))
              },
              timeout: 10000
            }, JSON.stringify(requestData));
            
            console.log('\n📥 Create Request Status:', createResponse.status);
            console.log('📥 Create Response:', createResponse.raw);
            
            if (createResponse.status === 200) {
              console.log('\n✅ SUCCESS: Subscription request created!');
              console.log('📋 Request ID:', createResponse.data.requestId);
              console.log('📋 Status:', createResponse.data.status);
            } else {
              console.log('\n❌ FAILED: Could not create subscription request');
              console.log('🔍 Error:', createResponse.data?.error || 'Unknown error');
            }
          } else {
            console.log('❌ No packages found in database');
          }
        } else {
          console.log('❌ Failed to fetch packages:', packagesResponse.raw);
        }
      } else {
        console.log('❌ No users found in database');
      }
    } else {
      console.log('❌ Failed to fetch users:', usersResponse.raw);
    }
    
  } catch (error) {
    console.error('\n❌ DEBUG ERROR:', error.message);
  }
}

if (require.main === module) {
  debugSubscriptionRequest();
}

module.exports = { debugSubscriptionRequest };
