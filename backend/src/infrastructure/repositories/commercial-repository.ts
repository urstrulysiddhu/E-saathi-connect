import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  PartnerTerms,
  Offer,
  CommercialTransaction,
  Settlement,
  DomainError,
} from '@e-saathi/core';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME || 'ESaathiDevices';

export class CommercialRepository {
  async saveTerms(terms: PartnerTerms): Promise<void> {
    try {
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            PK: `TERMS#${terms.partnerTermsId}`,
            SK: `TERMS#${terms.partnerTermsId}`,
            GSI1PK: `ORG#${terms.fromOrganizationId}`,
            GSI1SK: `TERMS#${terms.partnerTermsId}`,
            ...terms,
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        })
      );
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'ConditionalCheckFailedException')
        throw new DomainError('Terms already exist', 'CONFLICT');
      throw e;
    }
  }

  async saveOffer(offer: Offer): Promise<void> {
    try {
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            PK: `OFFER#${offer.offerId}`,
            SK: `OFFER#${offer.offerId}`,
            GSI1PK: `ORG#${offer.sourceOrganizationId}`,
            GSI1SK: `OFFER#${offer.offerId}`,
            ...offer,
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        })
      );
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'ConditionalCheckFailedException')
        throw new DomainError('Offer already exists', 'CONFLICT');
      throw e;
    }
  }

  async getOffer(offerId: string): Promise<Offer | null> {
    const res = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `OFFER#${offerId}`, SK: `OFFER#${offerId}` },
      })
    );
    if (!res.Item) return null;
    const offer = { ...res.Item };
    delete (offer as Record<string, unknown>).PK;
    delete (offer as Record<string, unknown>).SK;
    delete (offer as Record<string, unknown>).GSI1PK;
    delete (offer as Record<string, unknown>).GSI1SK;
    return offer as Offer;
  }

  async findApplicableOffers(categoryId: string): Promise<Offer[]> {
    // Basic scan for MVP. In reality, index by category/condition.
    const res = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :prefix) AND #status = :s AND deviceCategory = :cat',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':prefix': 'OFFER#',
          ':s': 'ACTIVE',
          ':cat': categoryId,
        },
      })
    );
    return (res.Items || []).map((i) => {
      const o = { ...i };
      delete (o as Record<string, unknown>).PK;
      delete (o as Record<string, unknown>).SK;
      delete (o as Record<string, unknown>).GSI1PK;
      delete (o as Record<string, unknown>).GSI1SK;
      return o as Offer;
    });
  }

  async saveTransaction(tx: CommercialTransaction): Promise<void> {
    try {
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            PK: `TX#${tx.transactionId}`,
            SK: `TX#${tx.transactionId}`,
            GSI1PK: `ORG#${tx.sourceOrganizationId}`,
            GSI1SK: `TX#${tx.transactionId}`,
            // We should also let destination org query this. 
            // In a real app we'd add GSI2 for destination, but MVP might just query GSI1.
            GSI2PK: `DEST_ORG#${tx.destinationOrganizationId}`,
            GSI2SK: `TX#${tx.transactionId}`,
            GSI3PK: `DEVICE#${tx.deviceId}`,
            GSI3SK: `TX#${tx.transactionId}`,
            ...tx,
          },
        })
      );
    } catch (e: unknown) {
      throw e;
    }
  }

  async getTransaction(txId: string): Promise<CommercialTransaction | null> {
    const res = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `TX#${txId}`, SK: `TX#${txId}` },
      })
    );
    if (!res.Item) return null;
    const tx = { ...res.Item };
    delete (tx as Record<string, unknown>).PK;
    delete (tx as Record<string, unknown>).SK;
    delete (tx as Record<string, unknown>).GSI1PK;
    delete (tx as Record<string, unknown>).GSI1SK;
    delete (tx as Record<string, unknown>).GSI2PK;
    delete (tx as Record<string, unknown>).GSI2SK;
    return tx as CommercialTransaction;
  }

  async listTransactionsByDestination(orgId: string): Promise<CommercialTransaction[]> {
    const res = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :org AND begins_with(GSI2SK, :prefix)',
        ExpressionAttributeValues: {
          ':org': `DEST_ORG#${orgId}`,
          ':prefix': 'TX#',
        },
      })
    );
    return (res.Items || []).map(item => {
      const tx = { ...item };
      delete (tx as Record<string, unknown>).PK;
      delete (tx as Record<string, unknown>).SK;
      delete (tx as Record<string, unknown>).GSI1PK;
      delete (tx as Record<string, unknown>).GSI1SK;
      delete (tx as Record<string, unknown>).GSI2PK;
      delete (tx as Record<string, unknown>).GSI2SK;
      return tx as CommercialTransaction;
    });
  }

  async getTransactionsByDevice(deviceId: string): Promise<CommercialTransaction[]> {
    let items: Record<string, any>[] = [];
    try {
      const res = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: 'GSI3',
          KeyConditionExpression: 'GSI3PK = :did AND begins_with(GSI3SK, :prefix)',
          ExpressionAttributeValues: {
            ':did': `DEVICE#${deviceId}`,
            ':prefix': 'TX#',
          },
        })
      );
      items = res.Items || [];
    } catch (e: any) {
      if (e.name === 'ValidationException' || (e.message && e.message.includes('is not active'))) {
        const res = await docClient.send(
          new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: 'deviceId = :did AND begins_with(PK, :prefix)',
            ExpressionAttributeValues: {
              ':did': deviceId,
              ':prefix': 'TX#',
            },
          })
        );
        items = res.Items || [];
      } else {
        throw e;
      }
    }

    return items.map(item => {
      const tx = { ...item };
      delete tx.PK;
      delete tx.SK;
      delete tx.GSI1PK;
      delete tx.GSI1SK;
      delete tx.GSI2PK;
      delete tx.GSI2SK;
      delete tx.GSI3PK;
      delete tx.GSI3SK;
      return tx as CommercialTransaction;
    });
  }

  async saveSettlement(settlement: Settlement): Promise<void> {
    try {
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            PK: `SETTLEMENT#${settlement.settlementId}`,
            SK: `SETTLEMENT#${settlement.settlementId}`,
            GSI1PK: `TX#${settlement.transactionId}`,
            GSI1SK: `SETTLEMENT#${settlement.settlementId}`,
            ...settlement,
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        })
      );
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'ConditionalCheckFailedException')
        throw new DomainError('Settlement exists', 'CONFLICT');
      throw e;
    }
  }

  async getSettlement(settlementId: string): Promise<Settlement | null> {
    const res = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `SETTLEMENT#${settlementId}`, SK: `SETTLEMENT#${settlementId}` },
      })
    );
    if (!res.Item) return null;
    const s = { ...res.Item };
    delete (s as Record<string, unknown>).PK;
    delete (s as Record<string, unknown>).SK;
    delete (s as Record<string, unknown>).GSI1PK;
    delete (s as Record<string, unknown>).GSI1SK;
    return s as Settlement;
  }
}
