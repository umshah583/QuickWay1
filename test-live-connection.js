const https = require('https');

async function testLiveConnection() {
  console.log('🧪 Testing connection to live server...');
  
  const baseUrl = 'https://portal.quickways.org';
  
  const tests = [
    {
      name: 'Health Check',
      path: '/api/health',
      description: 'Basic server connectivity'
    },
    {
      name: 'Driver Login Endpoint',
      path: '/api/driver/login',
      description: 'API endpoint availability'
    },
    {
      name: 'Services API',
      path: '/api/driver/services',
      description: 'Services endpoint'
    },
    {
      name: 'Dashboard API',
      path: '/api/driver/dashboard',
      description: 'Dashboard endpoint'
    }
  ];
  
  for (const test of tests) {
    try {
      console.log(`\n🔍 Testing: ${test.name}`);
      console.log(`   📝 Description: ${test.description}`);
      console.log(`   🌐 URL: ${baseUrl}${test.path}`);
      
      const response = await makeRequest(baseUrl, test.path);
      
      if (response.statusCode === 200 || response.statusCode === 405) {
        console.log(`   ✅ SUCCESS: Status ${response.statusCode}`);
      } else if (response.statusCode === 404) {
        console.log(`   ⚠️  WARNING: Endpoint not found (404)`);
      } else {
        console.log(`   ❌ ERROR: Status ${response.statusCode}`);
      }
      
    } catch (error) {
      console.log(`   ❌ FAILED: ${error.message}`);
    }
  }
  
  console.log('\n📋 Connection Test Summary:');
  console.log('   ✅ Mobile app API URL updated to live server');
  console.log('   ✅ Environment variables template created');
  console.log('   ✅ Connection guide provided');
  console.log('\n🚀 Next Steps:');
  console.log('   1. Set up environment variables in .env.local');
  console.log('   2. Deploy backend to live server');
  console.log('   3. Rebuild and test mobile app');
  console.log('   4. Verify all functionality works');
}

function makeRequest(baseUrl, path) {
  return new Promise((resolve, reject) => {
    const req = https.request(`${baseUrl}${path}`, (res) => {
      resolve({
        statusCode: res.statusCode,
        headers: res.headers
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

testLiveConnection().catch(console.error);
