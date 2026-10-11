# Architecture Guidelines

## Frontend (React PWA)

- Hosted on private S3, distributed via CloudFront with OAC.
- Offline-first capable using IndexedDB and Service Workers.

## API Gateway & Lambda

- API Gateway HTTP APIs provide routing with Cognito JWT Authorizers.
- Lambdas represent domain services (Identity, Asset Registry, Custody Engine, Verification Engine).

## Storage (DynamoDB & S3)

- DynamoDB uses a transactional design for authoritative state transitions.
- S3 is used for immutable evidence storage.

## Events (EventBridge & SQS)

- Domain events (e.g., `DeviceRegistered`, `CustodyTransitionVerified`) are published to EventBridge.
- SQS acts as a DLQ and buffer for reliable asynchronous processing.

## Workflows (Step Functions)

- Used for complex, long-running orchestration (e.g., anomaly investigation, automated verifications).
- Not used for simple CRUD APIs.

## Security & Observability

- All roles follow least-privilege IAM.
- CloudWatch provides structured logs, metrics, and alarms.
- Cognito isolates identity management.
