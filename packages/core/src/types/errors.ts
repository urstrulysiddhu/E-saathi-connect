export type ErrorCategory =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'DUPLICATE_REQUEST'
  | 'CONFLICT'
  | 'ANOMALY_BLOCKED'
  | 'INTERNAL_ERROR';

export class DomainError extends Error {
  public readonly code: ErrorCategory;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code: ErrorCategory, details?: Record<string, unknown>) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}
