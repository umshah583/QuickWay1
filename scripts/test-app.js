const http = require('http');

function testEndpoint(path, description) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          path,
          description,
          status: res.statusCode,
          success: res.statusCode < 500,
          contentType: res.headers['content-type']
        });
      });
    });

    req.on('error', (error) => {
      resolve({
        path,
        description,
        status: 'ERROR',
        success: false,
        error: error.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        path,
        description,
        status: 'TIMEOUT',
        success: false,
        error: 'Request timeout'
      });
    });

    req.end();
  });
}

async function runTests() {
  console.log('🔍 Testing QuickWay Application...\n');
  console.log('='.repeat(60));

  const tests = [
    { path: '/', description: 'Home Page' },
    { path: '/sign-in', description: 'Login Page' },
    { path: '/admin', description: 'Admin Dashboard' },
    { path: '/book', description: 'Booking Page' },
    { path: '/api/modules/user', description: 'API Test' },
    { path: '/api/driver/login', description: 'Driver API' },
  ];

  const results = [];
  
  for (const test of tests) {
    console.log(`📡 Testing: ${test.description} (${test.path})`);
    const result = await testEndpoint(test.path, test.description);
    results.push(result);
    
    if (result.success) {
      console.log(`✅ Status: ${result.status} | Content-Type: ${result.contentType || 'N/A'}`);
    } else {
      console.log(`❌ Status: ${result.status} | Error: ${result.error || 'Unknown error'}`);
    }
    console.log('');
  }

  console.log('='.repeat(60));
  console.log('📊 Test Summary:');
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Successful: ${successful}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.log('\n🔧 Failed Tests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.description}: ${r.error || r.status}`);
    });
  }

  if (successful === results.length) {
    console.log('\n🎉 All tests passed! Application is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the server logs and browser console.');
  }
}

// Run the tests
runTests().catch(console.error);
