import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as apigwv2_authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as path from 'path';

export class MainStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Identity Boundary: Amazon Cognito
    const userPool = new cognito.UserPool(this, 'ESaathiUserPool', {
      userPoolName: `esaathi-users-${this.node.tryGetContext('env') || 'dev'}`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      customAttributes: {
        role: new cognito.StringAttribute({ mutable: true }),
        org: new cognito.StringAttribute({ mutable: true }),
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For hackathon purposes
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'ESaathiAppClient', {
      userPool,
      generateSecret: false,
    });

    // Data Boundary: DynamoDB Device Registry
    const devicesTable = new dynamodb.Table(this, 'ESaathiDevicesTable', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    devicesTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    devicesTable.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    devicesTable.addGlobalSecondaryIndex({
      indexName: 'GSI3',
      partitionKey: { name: 'GSI3PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI3SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    devicesTable.addGlobalSecondaryIndex({
      indexName: 'GSI4',
      partitionKey: { name: 'GSI4PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI4SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Storage Boundary: S3 Evidence Bucket
    const evidenceBucket = new s3.Bucket(this, 'ESaathiEvidenceBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true, // For hackathon purposes
      enforceSSL: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: ['https://d1xflfgysejsv2.cloudfront.net', 'http://localhost:5173'], 
          allowedHeaders: ['*'],
        },
      ],
    });

    // Compute Boundary: Lambda
    const protectedRouteFunction = new nodejs.NodejsFunction(this, 'ProtectedRouteFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../../src/functions/protected-route.ts'),
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: {
        USER_POOL_ID: userPool.userPoolId,
      },
    });

    const devicesFunction = new nodejs.NodejsFunction(this, 'DevicesFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../../src/functions/devices.ts'),
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: {
        TABLE_NAME: devicesTable.tableName,
      },
    });

    devicesTable.grantReadWriteData(devicesFunction);

    // API Boundary: API Gateway HTTP API
    const httpApi = new apigwv2.HttpApi(this, 'ESaathiHttpApi', {
      apiName: 'ESaathi API',
      corsPreflight: {
        allowHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.HEAD,
          apigwv2.CorsHttpMethod.OPTIONS,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.PATCH,
          apigwv2.CorsHttpMethod.DELETE,
        ],
        allowOrigins: ['https://d1xflfgysejsv2.cloudfront.net', 'http://localhost:5173'],
        maxAge: cdk.Duration.days(10),
      },
    });

    const jwtAuthorizer = new apigwv2_authorizers.HttpJwtAuthorizer(
      'ESaathiJwtAuthorizer',
      userPool.userPoolProviderUrl,
      {
        jwtAudience: [userPoolClient.userPoolClientId],
      }
    );

    httpApi.addRoutes({
      path: '/auth-test',
      methods: [apigwv2.HttpMethod.GET],
      integration: new apigwv2_integrations.HttpLambdaIntegration(
        'AuthTestIntegration',
        protectedRouteFunction
      ),
      authorizer: jwtAuthorizer,
    });

    const custodyFunction = new nodejs.NodejsFunction(this, 'CustodyFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../../src/functions/custody.ts'),
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: {
        TABLE_NAME: devicesTable.tableName,
      },
    });

    devicesTable.grantReadWriteData(custodyFunction);

    const evidenceFunction = new nodejs.NodejsFunction(this, 'EvidenceFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../../src/functions/evidence.ts'),
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: {
        TABLE_NAME: devicesTable.tableName,
        BUCKET_NAME: evidenceBucket.bucketName,
      },
    });

    devicesTable.grantReadWriteData(evidenceFunction);
    evidenceBucket.grantReadWrite(evidenceFunction);

    const destinationsFunction = new nodejs.NodejsFunction(this, 'DestinationsFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../../src/functions/destinations.ts'),
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: { TABLE_NAME: devicesTable.tableName },
    });
    devicesTable.grantReadWriteData(destinationsFunction);

    const networkFunction = new nodejs.NodejsFunction(this, 'NetworkFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../../src/functions/network.ts'),
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: { TABLE_NAME: devicesTable.tableName },
    });
    devicesTable.grantReadWriteData(networkFunction);

    const notificationsFunction = new nodejs.NodejsFunction(this, 'NotificationsFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../../src/functions/notifications.ts'),
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: { TABLE_NAME: devicesTable.tableName },
    });
    devicesTable.grantReadWriteData(notificationsFunction);

    const routingFunction = new nodejs.NodejsFunction(this, 'RoutingFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../../src/functions/routing.ts'),
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: { TABLE_NAME: devicesTable.tableName },
    });
    devicesTable.grantReadWriteData(routingFunction);

    const commercialFunction = new nodejs.NodejsFunction(this, 'CommercialFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../../src/functions/commercial.ts'),
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: { TABLE_NAME: devicesTable.tableName },
    });
    devicesTable.grantReadWriteData(commercialFunction);

    const pickupRequestsFunction = new nodejs.NodejsFunction(this, 'PickupRequestsFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../../src/functions/pickup-requests.ts'),
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: { TABLE_NAME: devicesTable.tableName },
    });
    devicesTable.grantReadWriteData(pickupRequestsFunction);

    const devicesIntegration = new apigwv2_integrations.HttpLambdaIntegration(
      'DevicesIntegration',
      devicesFunction
    );

    const custodyIntegration = new apigwv2_integrations.HttpLambdaIntegration(
      'CustodyIntegration',
      custodyFunction
    );

    httpApi.addRoutes({
      path: '/devices',
      methods: [apigwv2.HttpMethod.POST, apigwv2.HttpMethod.GET],
      integration: devicesIntegration,
      authorizer: jwtAuthorizer,
    });

    httpApi.addRoutes({
      path: '/devices/{deviceId}',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.PATCH],
      integration: devicesIntegration,
      authorizer: jwtAuthorizer,
    });

    httpApi.addRoutes({
      path: '/devices/{deviceId}/custody/transition',
      methods: [apigwv2.HttpMethod.POST],
      integration: custodyIntegration,
      authorizer: jwtAuthorizer,
    });

    httpApi.addRoutes({
      path: '/devices/{deviceId}/custody',
      methods: [apigwv2.HttpMethod.GET],
      integration: custodyIntegration,
      authorizer: jwtAuthorizer,
    });

    httpApi.addRoutes({
      path: '/devices/{deviceId}/custody/latest',
      methods: [apigwv2.HttpMethod.GET],
      integration: custodyIntegration,
      authorizer: jwtAuthorizer,
    });

    httpApi.addRoutes({
      path: '/devices/{deviceId}/custody/verify',
      methods: [apigwv2.HttpMethod.GET],
      integration: custodyIntegration,
      authorizer: jwtAuthorizer,
    });

    const pickupRequestsIntegration = new apigwv2_integrations.HttpLambdaIntegration(
      'PickupRequestsIntegration',
      pickupRequestsFunction
    );

    const notificationsIntegration = new apigwv2_integrations.HttpLambdaIntegration(
      'NotificationsIntegration',
      notificationsFunction
    );

    httpApi.addRoutes({
      path: '/notifications',
      methods: [apigwv2.HttpMethod.GET],
      integration: notificationsIntegration,
      authorizer: jwtAuthorizer,
    });
    httpApi.addRoutes({
      path: '/notifications/{notificationId}/read',
      methods: [apigwv2.HttpMethod.POST],
      integration: notificationsIntegration,
      authorizer: jwtAuthorizer,
    });

    httpApi.addRoutes({
      path: '/requests',
      methods: [apigwv2.HttpMethod.POST, apigwv2.HttpMethod.GET],
      integration: pickupRequestsIntegration,
      authorizer: jwtAuthorizer,
    });

    httpApi.addRoutes({
      path: '/requests/{requestId}/accept',
      methods: [apigwv2.HttpMethod.POST],
      integration: pickupRequestsIntegration,
      authorizer: jwtAuthorizer,
    });

    httpApi.addRoutes({
      path: '/requests/{requestId}/reject',
      methods: [apigwv2.HttpMethod.POST],
      integration: pickupRequestsIntegration,
      authorizer: jwtAuthorizer,
    });

    httpApi.addRoutes({
      path: '/requests/{requestId}/escalate',
      methods: [apigwv2.HttpMethod.POST],
      integration: pickupRequestsIntegration,
      authorizer: jwtAuthorizer,
    });


    const evidenceIntegration = new apigwv2_integrations.HttpLambdaIntegration(
      'EvidenceIntegration',
      evidenceFunction
    );

    httpApi.addRoutes({
      path: '/evidence/upload-intent',
      methods: [apigwv2.HttpMethod.POST],
      integration: evidenceIntegration,
      authorizer: jwtAuthorizer,
    });

    httpApi.addRoutes({
      path: '/evidence/{evidenceId}/complete',
      methods: [apigwv2.HttpMethod.POST],
      integration: evidenceIntegration,
      authorizer: jwtAuthorizer,
    });

    httpApi.addRoutes({
      path: '/evidence/{evidenceId}',
      methods: [apigwv2.HttpMethod.GET],
      integration: evidenceIntegration,
      authorizer: jwtAuthorizer,
    });

    httpApi.addRoutes({
      path: '/evidence/{evidenceId}/access',
      methods: [apigwv2.HttpMethod.GET],
      integration: evidenceIntegration,
      authorizer: jwtAuthorizer,
    });

    httpApi.addRoutes({
      path: '/evidence/{evidenceId}/verify',
      methods: [apigwv2.HttpMethod.POST],
      integration: evidenceIntegration,
      authorizer: jwtAuthorizer,
    });

    httpApi.addRoutes({
      path: '/devices/{deviceId}/evidence',
      methods: [apigwv2.HttpMethod.GET],
      integration: evidenceIntegration,
      authorizer: jwtAuthorizer,
    });

    const destinationsIntegration = new apigwv2_integrations.HttpLambdaIntegration(
      'DestinationsIntegration',
      destinationsFunction
    );
    httpApi.addRoutes({
      path: '/destinations',
      methods: [apigwv2.HttpMethod.POST],
      integration: destinationsIntegration,
      authorizer: jwtAuthorizer,
    });
    httpApi.addRoutes({
      path: '/destinations/{destinationId}',
      methods: [apigwv2.HttpMethod.GET],
      integration: destinationsIntegration,
      authorizer: jwtAuthorizer,
    });

    const networkIntegration = new apigwv2_integrations.HttpLambdaIntegration(
      'NetworkIntegration',
      networkFunction
    );
    httpApi.addRoutes({
      path: '/network/relationships',
      methods: [apigwv2.HttpMethod.POST],
      integration: networkIntegration,
      authorizer: jwtAuthorizer,
    });

    const routingIntegration = new apigwv2_integrations.HttpLambdaIntegration(
      'RoutingIntegration',
      routingFunction
    );
    httpApi.addRoutes({
      path: '/devices/{deviceId}/routing/options',
      methods: [apigwv2.HttpMethod.GET],
      integration: routingIntegration,
      authorizer: jwtAuthorizer,
    });
    httpApi.addRoutes({
      path: '/devices/{deviceId}/routing/decisions',
      methods: [apigwv2.HttpMethod.POST],
      integration: routingIntegration,
      authorizer: jwtAuthorizer,
    });

    const commercialIntegration = new apigwv2_integrations.HttpLambdaIntegration(
      'CommercialIntegration',
      commercialFunction
    );
    httpApi.addRoutes({
      path: '/offers',
      methods: [apigwv2.HttpMethod.POST],
      integration: commercialIntegration,
      authorizer: jwtAuthorizer,
    });
    httpApi.addRoutes({
      path: '/commercial/transactions',
      methods: [apigwv2.HttpMethod.POST, apigwv2.HttpMethod.GET],
      integration: commercialIntegration,
      authorizer: jwtAuthorizer,
    });
    httpApi.addRoutes({
      path: '/commercial/transactions/{transactionId}/accept',
      methods: [apigwv2.HttpMethod.POST],
      integration: commercialIntegration,
      authorizer: jwtAuthorizer,
    });
    httpApi.addRoutes({
      path: '/commercial/transactions/{transactionId}/reject',
      methods: [apigwv2.HttpMethod.POST],
      integration: commercialIntegration,
      authorizer: jwtAuthorizer,
    });
    httpApi.addRoutes({
      path: '/commercial/transactions/{transactionId}/settlement',
      methods: [apigwv2.HttpMethod.POST],
      integration: commercialIntegration,
      authorizer: jwtAuthorizer,
    });
    httpApi.addRoutes({
      path: '/settlements/{settlementId}/confirm-simulated',
      methods: [apigwv2.HttpMethod.POST],
      integration: commercialIntegration,
      authorizer: jwtAuthorizer,
    });

    new cdk.CfnParameter(this, 'EnvironmentType', {
      type: 'String',
      default: 'dev',
      description: 'The deployment environment',
    });

    // Storage Boundary: S3 Frontend Bucket
    const frontendBucket = new s3.Bucket(this, 'ESaathiFrontendBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true, // For hackathon purposes
      enforceSSL: true,
    });

    const frontendDistribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(frontendBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    new cdk.CfnOutput(this, 'HttpApiUrl', { value: httpApi.url! });
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'ClientId', { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'DevicesTable', { value: devicesTable.tableName });
    new cdk.CfnOutput(this, 'EvidenceBucket', { value: evidenceBucket.bucketName });
    new cdk.CfnOutput(this, 'FrontendBucket', { value: frontendBucket.bucketName });
    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${frontendDistribution.distributionDomainName}`,
    });
    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: frontendDistribution.distributionId,
    });
    new cdk.CfnOutput(this, 'AwsRegion', { value: cdk.Aws.REGION });
  }
}
