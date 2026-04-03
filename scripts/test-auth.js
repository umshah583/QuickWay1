const http = require('http');

function testAuthEndpoints() {
  console.log('🔍 Testing Authentication Endpoints...\n');
  console.log('='.repeat(50));

  const endpoints = [
    { path: '/api/auth/session', description: 'Current Session' },
    { path: '/api/modules/user', description: 'User Modules (requires auth)' },
    { path: '/api/modules/user', description: 'User Modules (requires auth)' },
  ];

  endpoints.forEach((endpoint, index) => {
    setTimeout(() => {
      console.log(`\n📡 Testing: ${endpoint.description} (${endpoint.path})`);
      
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: endpoint.path,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'next-auth.session-token=test' // Try with a test cookie
        },
        timeout: 5000
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          console.log(`✅ Status: ${res.statusCode}`);
          console.log(`   Response: ${data.substring(0, 200)}...`);
          
          if (res.statusCode === 401) {
            console.log('   💡 Authentication required - user needs to log in');
          } else if (res.statusCode === 200) {
            console.log('   💡 Authentication working');
          }
        });
      });

      req.on('error', (error) => {
        console.log(`❌ Error: ${error.message}`);
      });

      req.on('timeout', () => {
        req.destroy();
        console.log(`❌ Timeout`);
      });
      
      req.end();
    }, index * 1000); // Stagger requests
  });
}

// Test without authentication first
function testUnauthenticated() {
  console.log('\n🔄 Testing without authentication...');
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/modules/user',
    method: 'GET',
    timeout: 5000
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log(`Status: ${res.statusCode}`);
      console.log(`Response: ${data}`);
      
      if (res.statusCode === 401) {
        console.log('✅ Expected: 401 Unauthorized when not authenticated');
      }
    });
  });

  req.on('error', (error) => {
    console.log(`Error: ${error.message}`);
  });
  
  req.end();
}

async function main() {
  try {
    testUnauthenticated();
    setTimeout(testAuthEndpoints, 2000);
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testAuthEndpoints, testUnauthenticated };
