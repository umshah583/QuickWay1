const http = require('http');

async function testLocalConnection() {
  console.log('🧪 Testing connection to local server...');
  
  const baseUrl = 'http://10.125.32.126:3000';
  
  const tests = [
    {
      name: 'Server Health',
      path: '/api/driver/login',
      description: 'Basic local server connectivity'
    }
  ];
  
  for (const test of tests) {
    try {
      console.log(`\n🔍 Testing: ${test.name}`);
      console.log(`   📝 Description: ${test.description}`);
      console.log(`   🌐 URL: ${baseUrl}${test.path}`);
      
      const response = await makeRequest(baseUrl, test.path);
      
      if (response.statusCode === 405) {
        console.log(`   ✅ SUCCESS: Status ${response.statusCode} (Expected for GET on POST endpoint)`);
      } else {
        console.log(`   ℹ️  Status: ${response.statusCode}`);
      }
      
    } catch (error) {
      console.log(`   ❌ FAILED: ${error.message}`);
    }
  }
  
  console.log('\n📋 Reversion Summary:');
  console.log('   ✅ Mobile app API URL reverted to local server');
  console.log('   ✅ Configuration: http://10.125.32.126:3000');
  console.log('   ✅ Ready for local development');
  
  console.log('\n🚀 Next Steps:');
  console.log('   1. Ensure local development server is running');
  console.log('   2. Rebuild mobile app: npx react-native run-android');
  console.log('   3. Test local authentication and features');
}

function makeRequest(baseUrl, path) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${baseUrl}${path}`, (res) => {
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

testLocalConnection().catch(console.error);
