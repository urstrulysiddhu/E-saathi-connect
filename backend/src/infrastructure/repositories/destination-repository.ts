import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  ScanCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Destination, DomainError } from '@e-saathi/core';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME || 'ESaathiDevices';

export class DestinationRepository {
  async save(destination: Destination): Promise<void> {
    try {
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            PK: `DESTINATION#${destination.destinationId}`,
            SK: `DESTINATION#${destination.destinationId}`,
            GSI1PK: `ORG#${destination.organizationId}`,
            GSI1SK: `DESTINATION#${destination.destinationId}`,
            GSI4PK: `STATUS#${destination.authorizationStatus}`,
            GSI4SK: `DESTINATION#${destination.destinationId}`,
            ...destination,
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        })
      );
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'ConditionalCheckFailedException') {
        throw new DomainError('Destination already exists', 'CONFLICT');
      }
      throw e;
    }
  }

  async getById(destinationId: string): Promise<Destination | null> {
    const res = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `DESTINATION#${destinationId}`,
          SK: `DESTINATION#${destinationId}`,
        },
      })
    );
    if (!res.Item) return null;
    const dest = { ...res.Item };
    delete (dest as Record<string, unknown>).PK;
    delete (dest as Record<string, unknown>).SK;
    delete (dest as Record<string, unknown>).GSI1PK;
    delete (dest as Record<string, unknown>).GSI1SK;
    return dest as Destination;
  }

  async listActive(): Promise<Destination[]> {
    let items: Record<string, any>[] = [];
    try {
      const res = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: 'GSI4',
          KeyConditionExpression: 'GSI4PK = :status AND begins_with(GSI4SK, :prefix)',
          ExpressionAttributeValues: {
            ':status': 'STATUS#ACTIVE',
            ':prefix': 'DESTINATION#',
          },
        })
      );
      items = res.Items || [];
    } catch (e: any) {
      if (e.name === 'ValidationException' || (e.message && e.message.includes('is not active'))) {
        const res = await docClient.send(
          new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: 'begins_with(PK, :pkPrefix) AND authorizationStatus = :active',
            ExpressionAttributeValues: {
              ':pkPrefix': 'DESTINATION#',
              ':active': 'ACTIVE',
            },
          })
        );
        items = res.Items || [];
      } else {
        throw e;
      }
    }

    return items.map((i) => {
      const dest = { ...i };
      delete dest.PK;
      delete dest.SK;
      delete dest.GSI1PK;
      delete dest.GSI1SK;
      delete dest.GSI4PK;
      delete dest.GSI4SK;
      return dest as Destination;
    });
  }

  async update(
    destinationId: string,
    expectedVersion: number,
    updates: Partial<Destination>
  ): Promise<Destination> {
    const updateExpr: string[] = ['#version = :newVersion', '#updatedAt = :updatedAt'];
    const exprNames: Record<string, string> = { '#version': 'version', '#updatedAt': 'updatedAt' };
    const exprValues: Record<string, unknown> = {
      ':expectedVersion': expectedVersion,
      ':newVersion': expectedVersion + 1,
      ':updatedAt': new Date().toISOString(),
    };

    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) {
        updateExpr.push(`#${k} = :${k}`);
        exprNames[`#${k}`] = k;
        exprValues[`:${k}`] = v;
      }
    }

    try {
      const res = await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: `DESTINATION#${destinationId}`, SK: `DESTINATION#${destinationId}` },
          UpdateExpression: `SET ${updateExpr.join(', ')}`,
          ConditionExpression: 'attribute_exists(PK) AND #version = :expectedVersion',
          ExpressionAttributeNames: exprNames,
          ExpressionAttributeValues: exprValues,
          ReturnValues: 'ALL_NEW',
        })
      );
      const dest = { ...(res.Attributes || {}) };
      delete (dest as Record<string, unknown>).PK;
      delete (dest as Record<string, unknown>).SK;
      delete (dest as Record<string, unknown>).GSI1PK;
      delete (dest as Record<string, unknown>).GSI1SK;
      return dest as Destination;
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'ConditionalCheckFailedException') {
        throw new DomainError('Stale version or not found', 'CONFLICT');
      }
      throw e;
    }
  }
}
