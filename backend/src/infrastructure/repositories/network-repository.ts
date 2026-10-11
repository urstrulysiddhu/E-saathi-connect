import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { NetworkRelationship, DomainError } from '@e-saathi/core';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME || 'ESaathiDevices';

export class NetworkRepository {
  async save(relationship: NetworkRelationship): Promise<void> {
    try {
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            PK: `RELATIONSHIP#${relationship.relationshipId}`,
            SK: `RELATIONSHIP#${relationship.relationshipId}`,
            GSI1PK: `ORG#${relationship.fromOrganizationId}`,
            GSI1SK: `RELATIONSHIP#${relationship.toOrganizationId}`,
            ...relationship,
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        })
      );
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'ConditionalCheckFailedException') {
        throw new DomainError('Relationship already exists', 'CONFLICT');
      }
      throw e;
    }
  }

  async getById(relationshipId: string): Promise<NetworkRelationship | null> {
    const res = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `RELATIONSHIP#${relationshipId}`,
          SK: `RELATIONSHIP#${relationshipId}`,
        },
      })
    );
    if (!res.Item) return null;
    const rel = { ...res.Item };
    delete (rel as Record<string, unknown>).PK;
    delete (rel as Record<string, unknown>).SK;
    delete (rel as Record<string, unknown>).GSI1PK;
    delete (rel as Record<string, unknown>).GSI1SK;
    return rel as NetworkRelationship;
  }

  async listByOrganization(organizationId: string): Promise<NetworkRelationship[]> {
    const res = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :org AND begins_with(GSI1SK, :rel)',
        ExpressionAttributeValues: {
          ':org': `ORG#${organizationId}`,
          ':rel': 'RELATIONSHIP#',
        },
      })
    );
    return (res.Items || []).map((i) => {
      const rel = { ...i };
      delete (rel as Record<string, unknown>).PK;
      delete (rel as Record<string, unknown>).SK;
      delete (rel as Record<string, unknown>).GSI1PK;
      delete (rel as Record<string, unknown>).GSI1SK;
      return rel as NetworkRelationship;
    });
  }
}
