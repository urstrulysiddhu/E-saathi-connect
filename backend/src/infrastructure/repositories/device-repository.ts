import { DynamoDBClient, ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  QueryCommandInput,
  ScanCommand,
  BatchGetCommand,
} from '@aws-sdk/lib-dynamodb';
import { Device, DeviceListResult, DomainError } from '@e-saathi/core';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

const TABLE_NAME = process.env.TABLE_NAME || 'ESaathiDevices';

// PK = DEVICE#<deviceId>
// SK = DEVICE#<deviceId>
// GSI1PK = ORG#<organizationId>
// GSI1SK = DEVICE#<createdAt>

export class DeviceRepository {
  async create(device: Device): Promise<void> {
    try {
      const item: any = {
        PK: `DEVICE#${device.deviceId}`,
        SK: `DEVICE#${device.deviceId}`,
        ...device,
      };

      if (device.registeredByOrganizationId) {
        item.GSI1PK = `ORG#${device.registeredByOrganizationId}`;
        item.GSI1SK = `DEVICE#${device.createdAt}`;
      }

      if (device.registeredByActorId) {
        item.GSI2PK = `ACTOR#${device.registeredByActorId}`;
        item.GSI2SK = `DEVICE#${device.createdAt}`;
      }

      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: item,
          ConditionExpression: 'attribute_not_exists(PK)',
        })
      );
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        throw new DomainError('Device already exists', 'CONFLICT');
      }
      throw error;
    }
  }

  async getById(deviceId: string): Promise<Device | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `DEVICE#${deviceId}`,
          SK: `DEVICE#${deviceId}`,
        },
        ConsistentRead: true,
      })
    );

    if (!result.Item) return null;

    // Remove DB specific keys
    const device = { ...result.Item };
    delete (device as Record<string, unknown>).PK;
    delete (device as Record<string, unknown>).SK;
    delete (device as Record<string, unknown>).GSI1PK;
    delete (device as Record<string, unknown>).GSI1SK;
    delete (device as Record<string, unknown>).GSI2PK;
    delete (device as Record<string, unknown>).GSI2SK;
    return device as Device;
  }

  async getByIds(deviceIds: string[]): Promise<Map<string, Device>> {
    const map = new Map<string, Device>();
    if (!deviceIds || deviceIds.length === 0) return map;

    const uniqueIds = Array.from(new Set(deviceIds)).filter(Boolean);
    for (let i = 0; i < uniqueIds.length; i += 100) {
      const chunk = uniqueIds.slice(i, i + 100);
      const keys = chunk.map((id) => ({
        PK: `DEVICE#${id}`,
        SK: `DEVICE#${id}`,
      }));

      const res = await docClient.send(
        new BatchGetCommand({
          RequestItems: {
            [TABLE_NAME]: {
              Keys: keys,
            },
          },
        })
      );

      const items = res.Responses?.[TABLE_NAME] || [];
      for (const item of items) {
        const device = { ...item };
        delete (device as Record<string, unknown>).PK;
        delete (device as Record<string, unknown>).SK;
        delete (device as Record<string, unknown>).GSI1PK;
        delete (device as Record<string, unknown>).GSI1SK;
        delete (device as Record<string, unknown>).GSI2PK;
        delete (device as Record<string, unknown>).GSI2SK;
        map.set(device.deviceId as string, device as Device);
      }
    }
    return map;
  }

  async listByOrganization(
    organizationId: string,
    limit: number = 20,
    nextToken?: string
  ): Promise<DeviceListResult> {
    const params: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :org AND begins_with(GSI1SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':org': `ORG#${organizationId}`,
        ':skPrefix': 'DEVICE#',
      },
      Limit: limit,
      ScanIndexForward: false, // newest first
    };

    if (nextToken) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString('utf-8'));
    }

    const result = await docClient.send(new QueryCommand(params));

    const items = (result.Items || [])
      .filter((item) => Boolean(item.deviceId))
      .map((item) => {
        const device = { ...item };
        delete (device as Record<string, unknown>).PK;
        delete (device as Record<string, unknown>).SK;
        delete (device as Record<string, unknown>).GSI1PK;
        delete (device as Record<string, unknown>).GSI1SK;
        delete (device as Record<string, unknown>).GSI2PK;
        delete (device as Record<string, unknown>).GSI2SK;
        return device as Device;
      });

    let newNextToken;
    if (result.LastEvaluatedKey) {
      newNextToken = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64');
    }

    return {
      items,
      nextToken: newNextToken,
    };
  }

  async listByActor(
    actorId: string,
    limit: number = 20,
    nextToken?: string
  ): Promise<DeviceListResult> {
    const params: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :actor AND begins_with(GSI2SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':actor': `ACTOR#${actorId}`,
        ':skPrefix': 'DEVICE#',
      },
      Limit: limit,
      ScanIndexForward: false, // newest first
    };

    if (nextToken) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString('utf-8'));
    }

    const result = await docClient.send(new QueryCommand(params));

    const items = (result.Items || []).map((item) => {
      const device = { ...item };
      delete (device as Record<string, unknown>).PK;
      delete (device as Record<string, unknown>).SK;
      delete (device as Record<string, unknown>).GSI1PK;
      delete (device as Record<string, unknown>).GSI1SK;
      delete (device as Record<string, unknown>).GSI2PK;
      delete (device as Record<string, unknown>).GSI2SK;
      return device as Device;
    });

    let newNextToken;
    if (result.LastEvaluatedKey) {
      newNextToken = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64');
    }

    return {
      items,
      nextToken: newNextToken,
    };
  }

  async listByCustodian(
    organizationId: string,
    limit: number = 20,
    nextToken?: string
  ): Promise<DeviceListResult> {
    const params: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: 'GSI3',
      KeyConditionExpression: 'GSI3PK = :custodian',
      ExpressionAttributeValues: {
        ':custodian': `CUSTODIAN#${organizationId}`,
      },
      Limit: limit,
      ScanIndexForward: false,
    };

    if (nextToken) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString('utf-8'));
    }

    const result = await docClient.send(new QueryCommand(params));

    const items = (result.Items || []).map((item) => {
      const device = { ...item };
      delete (device as Record<string, unknown>).PK;
      delete (device as Record<string, unknown>).SK;
      delete (device as Record<string, unknown>).GSI1PK;
      delete (device as Record<string, unknown>).GSI1SK;
      delete (device as Record<string, unknown>).GSI2PK;
      delete (device as Record<string, unknown>).GSI2SK;
      delete (device as Record<string, unknown>).GSI3PK;
      delete (device as Record<string, unknown>).GSI3SK;
      return device as Device;
    });

    let newNextToken;
    if (result.LastEvaluatedKey) {
      newNextToken = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64');
    }

    return {
      items,
      nextToken: newNextToken,
    };
  }

  async listAll(limit: number = 50, nextToken?: string): Promise<DeviceListResult> {
    const items: Device[] = [];
    let lastEvaluatedKey = nextToken
      ? JSON.parse(Buffer.from(nextToken, 'base64').toString('utf-8'))
      : undefined;

    do {
      const params: any = {
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :pk) AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': 'DEVICE#',
          ':sk': 'DEVICE#',
        },
        Limit: Math.min(limit * 2, 100),
      };

      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await docClient.send(new ScanCommand(params));
      const scannedDevices = (result.Items || [])
        .filter((item: any) => item.deviceId && !item.transactionId)
        .map((item: any) => {
          const device = { ...item };
          delete (device as Record<string, unknown>).PK;
          delete (device as Record<string, unknown>).SK;
          delete (device as Record<string, unknown>).GSI1PK;
          delete (device as Record<string, unknown>).GSI1SK;
          delete (device as Record<string, unknown>).GSI2PK;
          delete (device as Record<string, unknown>).GSI2SK;
          return device as Device;
        });

      items.push(...scannedDevices);
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (items.length < limit && lastEvaluatedKey);

    let newNextToken;
    if (lastEvaluatedKey) {
      newNextToken = Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64');
    }

    return { items, nextToken: newNextToken };
  }

  async update(
    deviceId: string,
    expectedVersion: number,
    updates: Partial<Device>
  ): Promise<Device> {
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, unknown> = {
      ':expectedVersion': expectedVersion,
      ':newVersion': expectedVersion + 1,
      ':updatedAt': new Date().toISOString(),
    };

    updateExpressions.push('#version = :newVersion');
    expressionAttributeNames['#version'] = 'version';

    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        const attrKey = `#${key}`;
        const valKey = `:${key}`;
        updateExpressions.push(`${attrKey} = ${valKey}`);
        expressionAttributeNames[attrKey] = key;
        expressionAttributeValues[valKey] = value;
        
        // Populate GSI3 for custodian index
        if (key === 'currentCustodianOrganizationId') {
          updateExpressions.push('#gsi3pk = :gsi3pkVal');
          updateExpressions.push('#gsi3sk = :gsi3skVal');
          expressionAttributeNames['#gsi3pk'] = 'GSI3PK';
          expressionAttributeNames['#gsi3sk'] = 'GSI3SK';
          expressionAttributeValues[':gsi3pkVal'] = `CUSTODIAN#${value}`;
          expressionAttributeValues[':gsi3skVal'] = `DEVICE#${deviceId}`;
        }
      }
    }

    try {
      const result = await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: `DEVICE#${deviceId}`,
            SK: `DEVICE#${deviceId}`,
          },
          UpdateExpression: `SET ${updateExpressions.join(', ')}`,
          ConditionExpression: 'attribute_exists(PK) AND #version = :expectedVersion',
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
          ReturnValues: 'ALL_NEW',
        })
      );

      const device = { ...(result.Attributes as Record<string, unknown>) };
      delete (device as Record<string, unknown>).PK;
      delete (device as Record<string, unknown>).SK;
      delete (device as Record<string, unknown>).GSI1PK;
      delete (device as Record<string, unknown>).GSI1SK;
      delete (device as Record<string, unknown>).GSI2PK;
      delete (device as Record<string, unknown>).GSI2SK;
      return device as unknown as Device;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        throw new DomainError(
          'Device update conflict (stale version) or device not found',
          'CONFLICT'
        );
      }
      throw error;
    }
  }

  // Idempotency: We'll use a separate record for idempotency keys
  // PK = IDEMPOTENCY#<key>, SK = IDEMPOTENCY#<key>
  async checkIdempotency(key: string, organizationId: string): Promise<string | null> {
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
    return result.Item ? result.Item.deviceId : null;
  }

  async saveIdempotency(key: string, organizationId: string, deviceId: string): Promise<void> {
    const fullKey = `${organizationId}#${key}`;
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `IDEMPOTENCY#${fullKey}`,
          SK: `IDEMPOTENCY#${fullKey}`,
          deviceId,
          ttl: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      })
    );
  }
}
