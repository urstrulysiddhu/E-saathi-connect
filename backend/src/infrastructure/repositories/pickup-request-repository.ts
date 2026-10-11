import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { PickupRequest } from '@e-saathi/core';

const TABLE_NAME = process.env.TABLE_NAME || 'ESaathiDevices';

export class PickupRequestRepository {
  private docClient: DynamoDBDocumentClient;

  constructor() {
    const client = new DynamoDBClient({});
    this.docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  async save(request: PickupRequest): Promise<void> {
    const item: any = {
      PK: `REQUEST#${request.requestId}`,
      SK: `REQUEST#${request.requestId}`,
      ...request,
    };

    if (request.status === 'PENDING') {
      item.GSI1PK = `REQUEST_STATUS#PENDING`;
      item.GSI1SK = `REQUEST#${request.createdAt}#${request.requestId}`;
    } else if (request.assignedCollectorOrganizationId) {
      item.GSI1PK = `ORG_REQUEST#${request.assignedCollectorOrganizationId}`;
      item.GSI1SK = `REQUEST#${request.updatedAt}#${request.requestId}`;
    }

    // Consumer queries their own requests via GSI2
    if (request.consumerActorId) {
      item.GSI2PK = `ACTOR_REQUEST#${request.consumerActorId}`;
      item.GSI2SK = `REQUEST#${request.createdAt}#${request.requestId}`;
    }

    const params: any = {
      TableName: TABLE_NAME,
      Item: item,
    };

    if (request.version === 1) {
      params.ConditionExpression = 'attribute_not_exists(PK)';
    } else {
      params.ConditionExpression = 'version = :expectedVersion OR attribute_not_exists(version)';
      params.ExpressionAttributeValues = {
        ':expectedVersion': request.version - 1,
      };
    }

    try {
      await this.docClient.send(new PutCommand(params));
    } catch (e: any) {
      if (e.name === 'ConditionalCheckFailedException') {
        throw new Error('Concurrent modification detected');
      }
      throw e;
    }
  }

  async getById(requestId: string): Promise<PickupRequest | null> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `REQUEST#${requestId}`,
          SK: `REQUEST#${requestId}`,
        },
      })
    );
    return (result.Item as PickupRequest) || null;
  }

  async getPendingRequests(limit = 50, nextToken?: string): Promise<{ items: PickupRequest[]; nextToken?: string }> {
    const queryOpts: any = {
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `REQUEST_STATUS#PENDING`,
      },
      Limit: limit,
    };
    
    if (nextToken) {
      queryOpts.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString('ascii'));
    }

    const result = await this.docClient.send(new QueryCommand(queryOpts));
    return {
      items: (result.Items as PickupRequest[]) || [],
      nextToken: result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : undefined,
    };
  }

  async getByCollectorOrg(orgId: string): Promise<PickupRequest[]> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `ORG_REQUEST#${orgId}`,
        },
      })
    );
    return (result.Items as PickupRequest[]) || [];
  }

  async listByConsumerActor(actorId: string): Promise<PickupRequest[]> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `ACTOR_REQUEST#${actorId}`,
        },
      })
    );
    return (result.Items as PickupRequest[]) || [];
  }
}
