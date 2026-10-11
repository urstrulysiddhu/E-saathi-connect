const { execSync } = require('child_process');
const fs = require('fs');

async function runTest() {
  console.log('--- STARTING E2E SMOKE TESTS ---');
  
  // Get stack outputs
  const outputsRaw = JSON.parse(fs.readFileSync('D:/college stuff/AWS ENVIRONMENTAL HACKS/E-Sathi Connect/backend/cdk-outputs.json', 'utf8'));
  const stackKey = Object.keys(outputsRaw)[0];
  const outputs = outputsRaw[stackKey];
  
  const apiUrl = outputs.HttpApiUrl.replace(/\/$/, '');
  const userPoolId = outputs.UserPoolId;
  const clientId = outputs.ClientId;
  
  console.log(`API URL: ${apiUrl}`);
  console.log(`UserPoolId: ${userPoolId}`);
  console.log(`ClientId: ${clientId}`);

  const runAws = (cmd) => {
    const output = execSync(`aws ${cmd} --profile esaathi-dev --output json`, { encoding: 'utf8' }).trim();
    return output ? JSON.parse(output) : {};
  };

  const createUser = (username, role) => {
    console.log(`Creating user ${username} with role ${role}...`);
    let attrs = `Name=email,Value=${username} Name=custom:role,Value=${role}`;
    if (role !== 'CONSUMER') {
      attrs += ` Name=custom:org,Value=${role}_ORG`;
    }
    try {
      runAws(`cognito-idp admin-create-user --user-pool-id ${userPoolId} --username ${username} --user-attributes ${attrs} --message-action SUPPRESS`);
      runAws(`cognito-idp admin-set-user-password --user-pool-id ${userPoolId} --username ${username} --password "Password123!" --permanent`);
    } catch (e) {
      console.log(`User ${username} already exists. Updating attributes...`);
      runAws(`cognito-idp admin-update-user-attributes --user-pool-id ${userPoolId} --username ${username} --user-attributes ${attrs}`);
    }
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

  createUser('consumer_test@test.com', 'CONSUMER');
  createUser('collector_test@test.com', 'COLLECTOR');
  createUser('hub_test@test.com', 'HUB');
  createUser('dest_test@test.com', 'DESTINATION');
  createUser('admin_test@test.com', 'ADMIN');

  const tokens = {
    consumer: await loginUser('consumer_test@test.com'),
    collector: await loginUser('collector_test@test.com'),
    hub: await loginUser('hub_test@test.com'),
    dest: await loginUser('dest_test@test.com'),
    admin: await loginUser('admin_test@test.com')
  };

  const req = async (path, method = 'GET', token, body = null) => {
    const opts = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`${apiUrl}${path}`, opts);
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(`API Error: ${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
    }
    return json;
  };

  try {
    // 1. Consumer authentication
    console.log('1. Consumer authenticated successfully (Token acquired).');

    // 2. Device registration
    console.log('2. Registering device...');
    const device = await req('/devices', 'POST', tokens.consumer, {
      manufacturer: 'Apple',
      model: 'iPhone 12',
      condition: 'USED',
      category: 'SMARTPHONE',
      idempotencyKey: Math.random().toString(36).substring(2)
    });
    const deviceId = device.deviceId;
    console.log(`   Device created: ${deviceId}`);
    
    // 3. Pickup request creation
    console.log('3. Creating pickup request...');
    const pickupReq = await req('/requests', 'POST', tokens.consumer, {
      deviceId,
      address: '123 Test St',
      preferredTime: 'Anytime',
      idempotencyKey: Math.random().toString(36).substring(2)
    });
    const requestId = pickupReq.requestId;
    console.log(`   Pickup request created: ${requestId}`);

    // 4. Collector sees and accepts
    console.log('4. Collector accepting pickup request...');
    await req(`/requests/${requestId}/accept`, 'POST', tokens.collector);
    console.log('   Pickup accepted.');

    let currentVersion = 1;
    console.log('4a. Consumer hands over device...');
    await req(`/devices/${deviceId}/custody/transition`, 'POST', tokens.consumer, {
      eventType: 'HANDOVER_INITIATED',
      expectedVersion: currentVersion,
      toActorId: 'collector_test@test.com',
      notes: 'Handing over',
      idempotencyKey: Math.random().toString(36).substring(2)
    });

    currentVersion++;
    console.log('4b. Collector accepts device custody...');
    await req(`/devices/${deviceId}/custody/transition`, 'POST', tokens.collector, {
      eventType: 'HANDOVER_ACCEPTED',
      expectedVersion: currentVersion,
      toActorId: 'collector_test@test.com',
      notes: 'Picked up',
      idempotencyKey: Math.random().toString(36).substring(2)
    });

    currentVersion++;
    
    console.log('4c. Collector proposes transaction to Hub...');
    const txRes1 = await req('/commercial/transactions', 'POST', tokens.collector, {
      deviceId: deviceId,
      destinationOrganizationId: 'HUB_ORG',
      agreedAmount: 50,
      currency: 'USD'
    });
    
    console.log('4d. Hub accepts transaction from Collector...');
    await req(`/commercial/transactions/${txRes1.transactionId}/accept`, 'POST', tokens.hub, {
      version: 1,
      agreedAmount: 50
    });

    console.log('5. Hub sees device and receives it...');
    await req(`/devices/${deviceId}/custody/transition`, 'POST', tokens.hub, {
      eventType: 'HUB_RECEIPT_CONFIRMED',
      expectedVersion: currentVersion,
      toActorId: 'hub_test@test.com',
      notes: 'Received at Hub',
      idempotencyKey: Math.random().toString(36).substring(2)
    });
    
    currentVersion++;
    console.log('5a(1). Hub assesses device...');
    await req(`/devices/${deviceId}/custody/transition`, 'POST', tokens.hub, {
      eventType: 'ASSESSMENT_RECORDED',
      expectedVersion: currentVersion,
      toActorId: 'hub_test@test.com',
      notes: 'Assessed at Hub',
      idempotencyKey: Math.random().toString(36).substring(2)
    });

    // Create Destination if it doesn't exist to make routing valid
    console.log('   Creating destination for routing...');
    const destObj = await req('/destinations', 'POST', tokens.admin, {
      name: 'Test Dest',
      organizationId: 'DESTINATION_ORG',
      destinationType: 'RECYCLER',
      authorizationStatus: 'ACTIVE',
      authorizationReference: 'AUTH-E2E-001',
      authorizationValidFrom: '2020-01-01T00:00:00Z',
      authorizationValidUntil: '2030-01-01T00:00:00Z',
      operationalStatus: 'OPERATIONAL',
      acceptedDeviceCategories: ['SMARTPHONE'],
      acceptedConditions: [],
      capabilities: ['MATERIAL_RECOVERY'],
      serviceAreas: ['AP'],
      location: { lat: 0, lng: 0, address: 'Destination Address' }
    });

    console.log('   Creating network relationship...');
    await req('/network/relationships', 'POST', tokens.admin, {
      fromOrganizationId: 'HUB_ORG',
      toOrganizationId: 'DESTINATION_ORG',
      relationshipType: 'HUB_TO_DESTINATION',
      status: 'ACTIVE',
      effectiveFrom: '2020-01-01T00:00:00Z',
      effectiveUntil: '2030-01-01T00:00:00Z'
    });

    // Hub routes
    console.log('   Hub routing device...');
    await req(`/devices/${deviceId}/routing/decisions`, 'POST', tokens.hub, {
      selectedDestinationId: destObj.destinationId,
      reason: 'Recycling',
      idempotencyKey: Math.random().toString(36).substring(2)
    });
    console.log('   Device routed to dest_test.');

    currentVersion++;
    console.log('5a(2). Hub confirms routing...');
    await req(`/devices/${deviceId}/custody/transition`, 'POST', tokens.hub, {
      eventType: 'ROUTING_CONFIRMED',
      expectedVersion: currentVersion,
      toActorId: 'hub_test@test.com',
      notes: 'Routing Confirmed',
      idempotencyKey: Math.random().toString(36).substring(2)
    });

    currentVersion++;

    console.log('5b. Hub proposes transaction to Destination...');
    const txRes2 = await req('/commercial/transactions', 'POST', tokens.hub, {
      deviceId: deviceId,
      destinationOrganizationId: 'DESTINATION_ORG',
      agreedAmount: 100,
      currency: 'USD'
    });

    console.log('5c. Destination accepts transaction from Hub...');
    await req(`/commercial/transactions/${txRes2.transactionId}/accept`, 'POST', tokens.dest, {
      version: 1,
      agreedAmount: 100
    });

    console.log('5a. Destination receives device...');
    await req(`/devices/${deviceId}/custody/transition`, 'POST', tokens.dest, {
      eventType: 'PROCESSING_STARTED',
      expectedVersion: currentVersion,
      toActorId: 'dest_test@test.com',
      notes: 'Received at Destination',
      idempotencyKey: Math.random().toString(36).substring(2)
    });

    currentVersion++;
    // 6. Destination records processing outcome
    console.log('6. Destination processing device...');
    await req(`/devices/${deviceId}/custody/transition`, 'POST', tokens.dest, {
      eventType: 'PROCESSING_COMPLETED',
      expectedVersion: currentVersion,
      toActorId: 'dest_test@test.com',
      metadata: { condition: 'RECYCLED' },
      notes: 'Device recycled',
      idempotencyKey: Math.random().toString(36).substring(2)
    });
    console.log('   Device processed.');

    // 7. Consumer sees status
    console.log('7. Consumer viewing custody history...');
    const custody = await req(`/devices/${deviceId}/custody`, 'GET', tokens.consumer);
    console.log(`   Custody history: ${custody.length} entries found.`);

    console.log('\n✅ ALL E2E SMOKE TESTS PASSED!');
  } catch (error) {
    console.error('\n❌ E2E TEST FAILED:', error.message);
    process.exit(1);
  }
}

runTest();
