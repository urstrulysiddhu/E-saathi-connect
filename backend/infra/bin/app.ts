import * as cdk from 'aws-cdk-lib';
import { MainStack } from '../lib/main-stack';
import { getEnvironmentConfig } from '../../src/config/environment';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';

async function main() {
  const app = new cdk.App();
  const config = getEnvironmentConfig();

  let account = config.awsAccount;
  if (!account || account === 'undefined') {
    try {
      const sts = new STSClient({ region: config.awsRegion });
      const response = await sts.send(new GetCallerIdentityCommand({}));
      account = response.Account as string;
    } catch (e) {
      console.warn('Could not determine AWS account from STS:', e);
    }
  }

  new MainStack(app, `ESaathiConnect-${config.environment}`, {
    env: { account, region: config.awsRegion },
  });

  app.synth();
}

main().catch((err) => {
  console.error('App initialization failed:', err);
  process.exit(1);
});
