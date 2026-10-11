import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { Evidence, DomainError } from '@e-saathi/core';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export class EvidenceRepository {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
    this.docClient = docClient;
    this.tableName = process.env.TABLE_NAME || '';
  }

  async saveEvidence(evidence: Evidence): Promise<void> {
    const params = {
      TableName: this.tableName,
      Item: {
        PK: `EVIDENCE#${evidence.evidenceId}`,
        SK: `EVIDENCE#${evidence.evidenceId}`,
        GSI1PK: `DEVICE#${evidence.deviceId}`,
        GSI1SK: `EVIDENCE#${evidence.evidenceId}`,
        ...evidence,
      },
      ConditionExpression: 'attribute_not_exists(PK)',
    };

    try {
      await this.docClient.send(new PutCommand(params));
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'name' in error &&
        error.name === 'ConditionalCheckFailedException'
      ) {
        throw new DomainError('Evidence ID already exists', 'CONFLICT');
      }
      throw error;
    }
  }

  async getEvidence(evidenceId: string): Promise<Evidence | null> {
    const params = {
      TableName: this.tableName,
      Key: {
        PK: `EVIDENCE#${evidenceId}`,
        SK: `EVIDENCE#${evidenceId}`,
      },
    };

    const result = await this.docClient.send(new GetCommand(params));
    if (!result.Item) return null;

    const evidence = { ...result.Item };
    delete (evidence as Record<string, unknown>).PK;
    delete (evidence as Record<string, unknown>).SK;
    delete (evidence as Record<string, unknown>).GSI1PK;
    delete (evidence as Record<string, unknown>).GSI1SK;
    return evidence as Evidence;
  }

  async updateEvidenceStatus(
    evidenceId: string,
    status: Evidence['status'],
    updates: Partial<Evidence> = {}
  ): Promise<void> {
    const updateExpressions: string[] = ['#status = :status'];
    const expressionAttributeNames: Record<string, string> = { '#status': 'status' };
    const expressionAttributeValues: Record<string, unknown> = { ':status': status };

    if (updates.sha256) {
      updateExpressions.push('#sha256 = :sha256');
      expressionAttributeNames['#sha256'] = 'sha256';
      expressionAttributeValues[':sha256'] = updates.sha256;
    }
    if (updates.uploadedAt) {
      updateExpressions.push('#uploadedAt = :uploadedAt');
      expressionAttributeNames['#uploadedAt'] = 'uploadedAt';
      expressionAttributeValues[':uploadedAt'] = updates.uploadedAt;
    }

    const params = {
      TableName: this.tableName,
      Key: {
        PK: `EVIDENCE#${evidenceId}`,
        SK: `EVIDENCE#${evidenceId}`,
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'attribute_exists(PK)',
    };

    try {
      await this.docClient.send(new UpdateCommand(params));
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'name' in error &&
        error.name === 'ConditionalCheckFailedException'
      ) {
        throw new DomainError('Evidence not found', 'NOT_FOUND');
      }
      throw error;
    }
  }

  async listByDevice(deviceId: string): Promise<Evidence[]> {
    const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
    const params = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `DEVICE#${deviceId}`,
        ':sk': 'EVIDENCE#',
      },
    };

    const result = await this.docClient.send(new QueryCommand(params));
    return (result.Items || []).map(item => {
      const evidence = { ...item };
      delete evidence.PK;
      delete evidence.SK;
      delete evidence.GSI1PK;
      delete evidence.GSI1SK;
      return evidence as Evidence;
    });
  }
}
