import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
  QueryCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';
import { CustodyEvent, Device, DomainError } from '@e-saathi/core';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'ESaathiDevices';

export class CustodyRepository {
  async appendEvent(device: Device, event: CustodyEvent, expectedVersion: number): Promise<void> {
    const updateExpressionParts = [
      '#lifecycleState = :newLifecycleState',
      '#version = :newVersion',
      '#updatedAt = :updatedAt',
      '#currentCustodianActorId = :currentCustodianActorId',
      '#currentCustodianOrganizationId = :currentCustodianOrganizationId'
    ];
    
    const expressionAttributeNames: Record<string, string> = {
      '#lifecycleState': 'lifecycleState',
      '#version': 'version',
      '#updatedAt': 'updatedAt',
      '#currentCustodianActorId': 'currentCustodianActorId',
      '#currentCustodianOrganizationId': 'currentCustodianOrganizationId',
    };
    
    const expressionAttributeValues: Record<string, unknown> = {
      ':newLifecycleState': device.lifecycleState,
      ':newVersion': expectedVersion + 1,
      ':updatedAt': new Date().toISOString(),
      ':currentCustodianActorId': device.currentCustodianActorId || null,
      ':currentCustodianOrganizationId': device.currentCustodianOrganizationId || null,
      ':expectedVersion': expectedVersion,
    };
    
    const relevantOrgId = device.currentCustodianOrganizationId || device.registeredByOrganizationId;
    if (relevantOrgId) {
      updateExpressionParts.push('#gsi1pk = :gsi1pk', '#gsi1sk = :gsi1sk');
      expressionAttributeNames['#gsi1pk'] = 'GSI1PK';
      expressionAttributeNames['#gsi1sk'] = 'GSI1SK';
      expressionAttributeValues[':gsi1pk'] = `ORG#${relevantOrgId}`;
      expressionAttributeValues[':gsi1sk'] = `DEVICE#${device.createdAt}`;
    }

    const transaction = new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: TABLE_NAME,
            Key: {
              PK: `DEVICE#${device.deviceId}`,
              SK: `DEVICE#${device.deviceId}`,
            },
            UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
            ConditionExpression: 'attribute_exists(PK) AND #version = :expectedVersion',
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
          },
        },
        {
          Put: {
            TableName: TABLE_NAME,
            Item: {
              PK: `DEVICE#${device.deviceId}`,
              SK: `EVENT#${event.occurredAt}#${event.eventId}`,
              ...event,
            },
            ConditionExpression: 'attribute_not_exists(PK)',
          },
        },
      ],
    });

    if (event.idempotencyKey && event.recordedByOrganizationId) {
      const fullKey = `${event.recordedByOrganizationId}#${event.idempotencyKey}`;
      transaction.input.TransactItems?.push({
        Put: {
          TableName: TABLE_NAME,
          Item: {
            PK: `IDEMPOTENCY#${fullKey}`,
            SK: `IDEMPOTENCY#${fullKey}`,
            eventId: event.eventId,
            deviceId: device.deviceId,
            ttl: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      });
    }

    try {
      await docClient.send(transaction);
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'name' in error &&
        error.name === 'TransactionCanceledException'
      ) {
        const reasons =
          (error as { CancellationReasons?: { Code: string }[] }).CancellationReasons || [];
        if (reasons[0]?.Code === 'ConditionalCheckFailed') {
          throw new DomainError('Device update conflict (stale version)', 'CONFLICT');
        }
        if (reasons[2]?.Code === 'ConditionalCheckFailed') {
          throw new DomainError('Idempotency key already exists', 'CONFLICT');
        }
      }
      throw error;
    }
  }

  async getDeviceTimeline(deviceId: string): Promise<CustodyEvent[]> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `DEVICE#${deviceId}`,
          ':skPrefix': 'EVENT#',
        },
        ScanIndexForward: true, // Chronological (oldest to newest)
      })
    );

    return (result.Items || []).map((item) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { PK, SK, ...event } = item;
      return event as CustodyEvent;
    });
  }

  async getLatestEvent(deviceId: string): Promise<CustodyEvent | null> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `DEVICE#${deviceId}`,
          ':skPrefix': 'EVENT#',
        },
        ScanIndexForward: false, // Newest first
        Limit: 1,
      })
    );

    if (!result.Items || result.Items.length === 0) return null;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { PK, SK, ...event } = result.Items[0];
    return event as CustodyEvent;
  }

  async getEventById(
    deviceId: string,
    eventId: string,
    occurredAt: string
  ): Promise<CustodyEvent | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `DEVICE#${deviceId}`,
          SK: `EVENT#${occurredAt}#${eventId}`,
        },
      })
    );

    if (!result.Item) return null;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { PK, SK, ...event } = result.Item;
    return event as CustodyEvent;
  }

  async checkIdempotency(
    key: string,
    organizationId: string
  ): Promise<{ eventId: string; deviceId: string } | null> {
    const fullKey = `${organizationId}#${key}`;
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `IDEMPOTENCY#${fullKey}`,
          SK: `IDEMPOTENCY#${fullKey}`,
        },
      })
    );
    if (!result.Item) return null;
    return { eventId: result.Item.eventId, deviceId: result.Item.deviceId };
  }
}
