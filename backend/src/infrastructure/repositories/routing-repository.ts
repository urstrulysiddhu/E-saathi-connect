import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { RoutingDecision, DomainError } from '@e-saathi/core';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME || 'ESaathiDevices';

export class RoutingRepository {
  async save(decision: RoutingDecision): Promise<void> {
    try {
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            PK: `DEVICE#${decision.deviceId}`,
            SK: `ROUTING#${decision.routingDecisionId}`,
            GSI1PK: `ORG#${decision.sourceOrganizationId}`,
            GSI1SK: `ROUTING#${decision.routingDecisionId}`,
            ...decision,
          },
          ConditionExpression: 'attribute_not_exists(SK)',
        })
      );
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'ConditionalCheckFailedException') {
        throw new DomainError('Routing decision already exists', 'CONFLICT');
      }
      throw e;
    }
  }

  async getById(deviceId: string, decisionId: string): Promise<RoutingDecision | null> {
    const res = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `DEVICE#${deviceId}`,
          SK: `ROUTING#${decisionId}`,
        },
      })
    );
    if (!res.Item) return null;
    const dec = { ...res.Item };
    delete (dec as Record<string, unknown>).PK;
    delete (dec as Record<string, unknown>).SK;
    delete (dec as Record<string, unknown>).GSI1PK;
    delete (dec as Record<string, unknown>).GSI1SK;
    return dec as RoutingDecision;
  }

  async listByDevice(deviceId: string): Promise<RoutingDecision[]> {
    const res = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `DEVICE#${deviceId}`,
          ':sk': 'ROUTING#',
        },
      })
    );
    return (res.Items || []).map((i) => {
      const dec = { ...i };
      delete (dec as Record<string, unknown>).PK;
      delete (dec as Record<string, unknown>).SK;
      delete (dec as Record<string, unknown>).GSI1PK;
      delete (dec as Record<string, unknown>).GSI1SK;
      return dec as RoutingDecision;
    });
  }

  async updateStatus(
    deviceId: string,
    decisionId: string,
    status: string,
    version: number
  ): Promise<void> {
    try {
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: `DEVICE#${deviceId}`, SK: `ROUTING#${decisionId}` },
          UpdateExpression: 'SET decisionStatus = :s, #version = :nv',
          ConditionExpression: 'attribute_exists(PK) AND #version = :v',
          ExpressionAttributeNames: { '#version': 'version' },
          ExpressionAttributeValues: {
            ':s': status,
            ':v': version,
            ':nv': version + 1,
          },
        })
      );
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'ConditionalCheckFailedException') {
        throw new DomainError('Stale version or not found', 'CONFLICT');
      }
      throw e;
    }
  }
}
