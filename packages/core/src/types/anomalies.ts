export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AnomalyStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CONFIRMED_EXCEPTION';

export interface Anomaly {
  anomalyId: string;
  deviceId: string;
  anomalyType: string;
  severity: AnomalySeverity;
  detectedAt: string;
  reason: string;
  supportingEvidence: string[];
  status: AnomalyStatus;
  reviewerId?: string;
  resolution?: string;
}

export type MissingReceiptStatus =
  'EXPECTED' | 'PENDING' | 'OVERDUE' | 'ESCALATED' | 'RESOLVED' | 'CONFIRMED_EXCEPTION';
