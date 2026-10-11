/* eslint-disable */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const run = (cmd, opts = {}) => {
  console.log(`\n> ${cmd}`);
  return execSync(cmd, { stdio: 'inherit', ...opts });
};

const runAndReturn = (cmd) => {
  console.log(`\n> ${cmd}`);
  return execSync(cmd, { encoding: 'utf-8' }).trim();
};

async function deploy() {
  try {
    console.log('--- PHASE 8 DEPLOYMENT SCRIPT ---');

    // 1. Deploy CDK and export outputs
    console.log('Deploying backend...');
    const backendDir = path.join(__dirname, '../backend');
    const outputsFile = path.join(backendDir, 'cdk-outputs.json');
    run(`npx cdk deploy ESaathiConnect-dev --profile esaathi-dev --require-approval never --outputs-file cdk-outputs.json`, {
      cwd: backendDir,
    });

    // 2. Read outputs
    if (!fs.existsSync(outputsFile)) {
      throw new Error(`Outputs file not found at ${outputsFile}`);
    }
    const outputsRaw = JSON.parse(fs.readFileSync(outputsFile, 'utf8'));

    // CDK outputs are usually keyed by stack name, e.g. ESaathiBackendStack or TestStack
    const stackKey = Object.keys(outputsRaw)[0];
    const outputs = outputsRaw[stackKey];

    const apiUrl = outputs.HttpApiUrl;
    const userPoolId = outputs.UserPoolId;
    const clientId = outputs.ClientId;
    const awsRegion = outputs.AwsRegion || 'ap-southeast-2';
    const frontendBucket = outputs.FrontendBucket;
    const distributionId = outputs.CloudFrontDistributionId;

    if (!apiUrl || !userPoolId || !clientId || !frontendBucket || !distributionId) {
      throw new Error('Missing one or more required CDK outputs. Did the stack deploy properly?');
    }

    console.log('\n--- CDK Outputs Loaded ---');
    console.log(`API URL: ${apiUrl}`);
    console.log(`User Pool ID: ${userPoolId}`);
    console.log(`Client ID: ${clientId}`);
    console.log(`Frontend Bucket: ${frontendBucket}`);
    console.log(`Distribution ID: ${distributionId}`);

    // 3. Build frontend with outputs
    console.log('\nBuilding frontend...');
    const buildEnv = {
      ...process.env,
      VITE_API_URL: apiUrl,
      VITE_USER_POOL_ID: userPoolId,
      VITE_CLIENT_ID: clientId,
      VITE_AWS_REGION: awsRegion,
    };

    execSync('npm run build', {
      cwd: path.join(__dirname, '../apps/web-pwa'),
      stdio: 'inherit',
      env: buildEnv,
    });

    // 4. Upload to S3
    console.log('\nSyncing to Frontend S3 Bucket...');
    run(`aws s3 sync apps/web-pwa/dist s3://${frontendBucket} --delete --profile esaathi-dev`);

    // 5. Invalidate CloudFront
    console.log('\nInvalidating CloudFront cache...');
    run(`aws cloudfront create-invalidation --distribution-id ${distributionId} --paths "/*" --profile esaathi-dev`);

    console.log('\n--- DEPLOYMENT SUCCESSFUL ---');
    console.log(`URL: ${outputs.CloudFrontUrl}`);
  } catch (error) {
    console.error('\nDeployment failed:', error.message);
    process.exit(1);
  }
}

deploy();
