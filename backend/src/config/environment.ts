export interface EnvironmentConfig {
  environment: 'dev' | 'staging' | 'prod';
  awsAccount: string;
  awsRegion: string;
}

export const getEnvironmentConfig = (): EnvironmentConfig => {
  return {
    environment: (process.env.ENVIRONMENT as 'dev' | 'staging' | 'prod') || 'dev',
    awsAccount: process.env.CDK_DEFAULT_ACCOUNT as string,
    awsRegion: 'ap-southeast-2',
  };
};
