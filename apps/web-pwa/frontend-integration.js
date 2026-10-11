const { execSync } = require('child_process');
const fs = require('fs');

async function runTest() {
  console.log('--- STARTING FRONTEND DASHBOARD API INTEGRATION TESTS ---');
  
  // 1. Get Stack Outputs
  const outputRaw = execSync('aws cloudformation describe-stacks --stack-name ESaathiConnect-dev --profile esaathi-dev --output json', { encoding: 'utf8' });
  const outputsList = JSON.parse(outputRaw).Stacks[0].Outputs;
  const outputs = {};
  for (const o of outputsList) outputs[o.OutputKey] = o.OutputValue;
  
  const apiUrl = outputs.HttpApiUrl.replace(/\/$/, '');
  const userPoolId = outputs.UserPoolId;
  const clientId = outputs.ClientId;
  
  const runAws = (cmd) => {
    const out = execSync(`aws ${cmd} --profile esaathi-dev --output json`, { encoding: 'utf8' }).trim();
    return out ? JSON.parse(out) : {};
  };

  const loginUser = (username) => {
    console.log(`Logging in user ${username}...`);
    return new Promise((resolve, reject) => {
      const { CognitoUserPool, CognitoUser, AuthenticationDetails } = require('amazon-cognito-identity-js');
      const userPool = new CognitoUserPool({ UserPoolId: userPoolId, ClientId: clientId });
      const authenticationDetails = new AuthenticationDetails({ Username: username, Password: 'Password123!' });
      const cognitoUser = new CognitoUser({ Username: username, Pool: userPool });
      cognitoUser.authenticateUser(authenticationDetails, {
          onSuccess: function(result) {
              resolve(result.getIdToken().getJwtToken());
          },
          onFailure: function(err) {
              reject(err);
          }
      });
    });
  };

  const tokens = {
    consumer: await loginUser('consumer_test@test.com'),
    collector: await loginUser('collector_test@test.com'),
    hub: await loginUser('hub_test@test.com'),
    dest: await loginUser('dest_test@test.com'),
    admin: await loginUser('admin_test@test.com')
  };

  const req = async (path, method, token, body = null) => {
    const headers = { 'Authorization': `Bearer ${token}` };
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${apiUrl}${path}`, {
      method, headers, body: body ? JSON.stringify(body) : null
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`API Error: ${method} ${path} -> ${res.status} ${text}`);
    return text ? JSON.parse(text) : {};
  };

  try {
    // === CONSUMER DASHBOARD VERIFICATION ===
    console.log('\n[1] Verifying Consumer Dashboard...');
    const consDevices = await req('/devices', 'GET', tokens.consumer);
    console.log(`    Consumer devices fetched: ${consDevices.items?.length || 0}`);
    if (!consDevices.items || consDevices.items.length === 0) throw new Error("Consumer has no devices!");
    const targetDevice = consDevices.items[0];

    // === COLLECTOR DASHBOARD VERIFICATION ===
    console.log('\n[2] Verifying Collector Dashboard...');
    const collDevices = await req('/devices', 'GET', tokens.collector);
    console.log(`    Collector devices fetched: ${collDevices.items?.length || 0}`);

    // === HUB DASHBOARD VERIFICATION ===
    console.log('\n[3] Verifying Hub Dashboard...');
    const hubDevices = await req('/devices', 'GET', tokens.hub);
    console.log(`    Hub devices fetched: ${hubDevices.items?.length || 0}`);
    const hubTxs = await req('/commercial/transactions', 'GET', tokens.hub);
    console.log(`    Hub transactions fetched: ${hubTxs.items?.length || 0}`);

    // === DESTINATION DASHBOARD VERIFICATION ===
    console.log('\n[4] Verifying Destination Dashboard...');
    const destDevices = await req('/devices', 'GET', tokens.dest);
    console.log(`    Destination devices fetched: ${destDevices.items?.length || 0}`);
    const destTxs = await req('/commercial/transactions', 'GET', tokens.dest);
    console.log(`    Destination transactions fetched: ${destTxs.items?.length || 0}`);

    // === ADMIN DASHBOARD VERIFICATION ===
    console.log('\n[5] Verifying Admin Dashboard & Operations...');
    const adminDevices = await req('/devices', 'GET', tokens.admin);
    const processedDevices = (adminDevices.items || []).filter(d => ['PROCESSED', 'VERIFIED'].includes(d.lifecycleState));
    console.log(`    Admin PROCESSED/VERIFIED devices found: ${processedDevices.length}`);
    
    if (processedDevices.length > 0) {
      let d = processedDevices[0];
      if (d.lifecycleState === 'PROCESSED') {
        console.log(`    Admin verifying processed device ${d.deviceId}...`);
        await req(`/devices/${d.deviceId}/custody/transition`, 'POST', tokens.admin, {
          eventType: 'VERIFICATION_COMPLETED',
          expectedVersion: d.version,
          toActorId: 'admin_test@test.com',
          notes: 'Verified by Admin',
          idempotencyKey: Math.random().toString(36).substring(2)
        });
        d.version++;
        d.lifecycleState = 'VERIFIED';
        console.log(`    Device verified!`);
      }
      
      if (d.lifecycleState === 'VERIFIED') {
        console.log(`    Admin closing device ${d.deviceId}...`);
        await req(`/devices/${d.deviceId}/custody/transition`, 'POST', tokens.admin, {
          eventType: 'CLOSURE_CONFIRMED',
          expectedVersion: d.version,
          toActorId: 'admin_test@test.com',
          notes: 'Closed by Admin',
          idempotencyKey: Math.random().toString(36).substring(2)
        });
        console.log(`    Device closed! Admin dashboard fully functional.`);
      }
    } else {
      console.log('    WARNING: No PROCESSED devices found for Admin to verify. Admin can fetch devices successfully.');
    }

    // === EVIDENCE UPLOAD VERIFICATION ===
    console.log('\n[6] Verifying Evidence Upload API...');
    const dummyData = 'mock image data';
    const evidenceReq = await req('/evidence/upload-intent', 'POST', tokens.consumer, {
      deviceId: targetDevice.deviceId,
      evidenceType: 'DEVICE_PHOTO',
      contentType: 'image/jpeg',
      fileSizeBytes: dummyData.length
    });
    console.log('    Evidence upload URL generated successfully.');
    if (!evidenceReq.presignedUrl || !evidenceReq.evidenceId) {
      console.log(evidenceReq);
      throw new Error("Missing upload URL or evidence ID!");
    }
    
    // Upload dummy data to S3 using the presigned URL
    console.log('    Uploading mock evidence to S3 presigned URL...');
    const uploadRes = await fetch(evidenceReq.presignedUrl, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'image/jpeg'
      },
      body: dummyData
    });
    if (!uploadRes.ok) throw new Error(`Evidence S3 Upload failed: ${uploadRes.status}`);
    console.log('    Evidence mock upload succeeded.');

    // Complete upload
    console.log('    Completing evidence upload...');
    await req(`/evidence/${evidenceReq.evidenceId}/complete`, 'POST', tokens.consumer);
    console.log('    Evidence marked as complete.');

    console.log('\n✅ ALL FRONTEND INTEGRATION TESTS PASSED!');
  } catch (err) {
    console.error('\n❌ FRONTEND INTEGRATION TEST FAILED:', err.message);
    process.exit(1);
  }
}

runTest();
