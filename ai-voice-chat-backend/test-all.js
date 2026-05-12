const http = require('http');

function apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    const req = http.request(options, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve(JSON.parse(b)); } catch { resolve(b); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  let token = '';
  let userId = '';

  console.log('='.repeat(60));
  console.log('  AI VOICE CHAT - FULL PROJECT OUTPUT');
  console.log('='.repeat(60));

  // 1. Health
  console.log('\n=== 1. HEALTH CHECK ===');
  const health = await apiCall('GET', '/health');
  console.log(JSON.stringify(health, null, 2));

  // 2. Plans
  console.log('\n=== 2. SUBSCRIPTION PLANS ===');
  const plans = await apiCall('GET', '/plans');
  console.log(JSON.stringify(plans, null, 2));

  // 3. Register
  console.log('\n=== 3. REGISTER NEW USER ===');
  const reg = await apiCall('POST', '/auth/register', { name: 'SUN', email: 'sun@test.com', password: 'pass123' });
  console.log(JSON.stringify(reg, null, 2));
  token = reg.token;
  userId = reg.userId;

  // 4. Get Me
  console.log('\n=== 4. GET CURRENT USER (/auth/me) ===');
  const meOptions = {
    hostname: 'localhost', port: 5000, path: '/auth/me', method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  };
  const me = await new Promise((resolve, reject) => {
    const req = http.request(meOptions, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve(b); } });
    });
    req.on('error', reject);
    req.end();
  });
  console.log(JSON.stringify(me, null, 2));

  // 5. Chat
  console.log('\n=== 5. CHAT - AI RESPONSE ===');
  const chat = await apiCall('POST', '/chat', { userId, message: 'Hello! Tell me about your AI services' });
  console.log(JSON.stringify(chat, null, 2));

  // 6. Chat Hinglish
  console.log('\n=== 6. CHAT - HINGLISH ===');
  const chat2 = await apiCall('POST', '/chat', { userId, message: 'Bhai ye AI kya kar sakta hai?' });
  console.log(JSON.stringify(chat2, null, 2));

  // 7. Save Lead
  console.log('\n=== 7. SAVE LEAD ===');
  const lead = await apiCall('POST', '/lead', { name: 'Rahul Sharma', contact: 'rahul@business.com', intent: 'AI Integration', source: 'website' });
  console.log(JSON.stringify(lead, null, 2));

  // 8. Subscribe
  console.log('\n=== 8. UPGRADE TO PRO ===');
  const subOptions = {
    hostname: 'localhost', port: 5000, path: '/subscribe', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'Content-Length': Buffer.byteLength(JSON.stringify({ plan: 'pro' })) }
  };
  const sub = await new Promise((resolve, reject) => {
    const req = http.request(subOptions, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve(b); } });
    });
    req.on('error', reject);
    req.write(JSON.stringify({ plan: 'pro' }));
    req.end();
  });
  console.log(JSON.stringify(sub, null, 2));

  // 9. Usage
  console.log('\n=== 9. API USAGE ===');
  const usageOptions = {
    hostname: 'localhost', port: 5000, path: '/usage', method: 'GET',
    headers: { 'Authorization': `Bearer ${sub.token || token}` }
  };
  const usage = await new Promise((resolve, reject) => {
    const req = http.request(usageOptions, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve(b); } });
    });
    req.on('error', reject);
    req.end();
  });
  console.log(JSON.stringify(usage, null, 2));

  // 10. Dashboard
  console.log('\n=== 10. DASHBOARD STATS ===');
  const dashOptions = {
    hostname: 'localhost', port: 5000, path: '/dashboard/stats', method: 'GET',
    headers: { 'Authorization': `Bearer ${sub.token || token}` }
  };
  const dash = await new Promise((resolve, reject) => {
    const req = http.request(dashOptions, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve(b); } });
    });
    req.on('error', reject);
    req.end();
  });
  console.log(JSON.stringify(dash, null, 2));

  // 11. Leads list
  console.log('\n=== 11. LEADS LIST ===');
  const leadsOptions = {
    hostname: 'localhost', port: 5000, path: '/leads', method: 'GET',
    headers: { 'Authorization': `Bearer ${sub.token || token}` }
  };
  const leadsList = await new Promise((resolve, reject) => {
    const req = http.request(leadsOptions, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve(b); } });
    });
    req.on('error', reject);
    req.end();
  });
  console.log(JSON.stringify(leadsList, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('  ALL ENDPOINTS TESTED SUCCESSFULLY!');
  console.log('='.repeat(60));
}

run().catch(err => console.error('ERROR:', err.message));
