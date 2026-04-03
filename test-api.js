const http = require('http');

const options = {
  hostname: '10.150.189.126',
  port: 3000,
  path: '/api/auth/mobile-token',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response:', data);
  });
});

req.on('error', (e) => {
  console.error('Request failed:', e.message);
});

req.write(JSON.stringify({
  email: 'umshah956@gmail.com',
  password: '12345678'
}));

req.end();
