import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Notification } from '@e-saathi/core';

const TABLE_NAME = process.env.TABLE_NAME || 'ESaathiDevices';

export class NotificationRepository {
  private docClient: DynamoDBDocumentClient;

  constructor() {
    const client = new DynamoDBClient({});
    this.docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  async save(notification: Notification): Promise<void> {
    const item: any = {
      PK: `NOTIF#${notification.notificationId}`,
      SK: `NOTIF#${notification.notificationId}`,
      ...notification,
    };

    if (notification.organizationId) {
      item.GSI1PK = `ORG_NOTIF#${notification.organizationId}`;
      item.GSI1SK = `NOTIF#${notification.createdAt}#${notification.notificationId}`;
    }

    if (notification.actorId) {
      item.GSI2PK = `ACTOR_NOTIF#${notification.actorId}`;
      item.GSI2SK = `NOTIF#${notification.createdAt}#${notification.notificationId}`;
    }

    await this.docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      })
    );
  }

  async listForActor(actorId: string, limit = 50): Promise<Notification[]> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `ACTOR_NOTIF#${actorId}`,
        },
        ScanIndexForward: false, // newest first
        Limit: limit,
      })
    );
    return (result.Items as Notification[]) || [];
  }

  async listForOrganization(organizationId: string, limit = 50): Promise<Notification[]> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `ORG_NOTIF#${organizationId}`,
        },
        ScanIndexForward: false, // newest first
        Limit: limit,
      })
    );
    return (result.Items as Notification[]) || [];
  }

  async markAsRead(notificationId: string): Promise<void> {
    await this.docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `NOTIF#${notificationId}`,
          SK: `NOTIF#${notificationId}`,
        },
        UpdateExpression: 'SET #status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'READ',
        },
      })
    );
  }
}
