import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { MainStack } from '../infra/lib/main-stack';

jest.mock('aws-cdk-lib/aws-lambda-nodejs', () => {
  const aws_lambda = require('aws-cdk-lib/aws-lambda');
  return {
    NodejsFunction: class extends aws_lambda.Function {
      constructor(scope: any, id: string, props: any) {
        super(scope, id, {
          ...props,
          code: aws_lambda.Code.fromInline('exports.handler = async () => {};'),
          handler: 'index.handler',
        });
      }
    }
  };
});

test('Main Stack Synthesizes with Security Boundaries', () => {
  const app = new cdk.App();
  const stack = new MainStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::Cognito::UserPool', {
    AdminCreateUserConfig: { AllowAdminCreateUserOnly: true },
  });

  template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
    GenerateSecret: false,
  });

  template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
    ProtocolType: 'HTTP',
  });

  template.hasResourceProperties('AWS::ApiGatewayV2::Authorizer', {
    AuthorizerType: 'JWT',
  });

  template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
    AuthorizationType: 'JWT',
  });

  template.hasResourceProperties('AWS::Lambda::Function', {
    Runtime: 'nodejs20.x',
  });

  template.hasResourceProperties('AWS::DynamoDB::Table', {
    BillingMode: 'PAY_PER_REQUEST',
    SSESpecification: { SSEEnabled: true },
    GlobalSecondaryIndexes: [
      {
        IndexName: 'GSI1',
        KeySchema: [
          { AttributeName: 'GSI1PK', KeyType: 'HASH' },
          { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'GSI2',
        KeySchema: [
          { AttributeName: 'GSI2PK', KeyType: 'HASH' },
          { AttributeName: 'GSI2SK', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'GSI3',
        KeySchema: [
          { AttributeName: 'GSI3PK', KeyType: 'HASH' },
          { AttributeName: 'GSI3SK', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'GSI4',
        KeySchema: [
          { AttributeName: 'GSI4PK', KeyType: 'HASH' },
          { AttributeName: 'GSI4SK', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  });
});
