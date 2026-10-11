# Phase 0 Constitution Changelog

This document tracks the architectural and conceptual hardening applied to the e-Saathi Connect engineering constitution prior to Phase 1 implementation.

## v1.1 $\rightarrow$ v1.2

1. **Explicit lifecycle transition matrix added:** Expanded Section 15 to include the strict rules, actors, required evidence, and blocking conditions for every transition between the 10 lifecycle states.
2. **Invalid transition rules added:** Explicitly prohibited arbitrary state jumps and affirmed the server-side custody engine as authoritative.
3. **Failure/exception behavior clarified:** Explicitly documented the exact system responses (e.g., BLOCKED, REJECTED, LOCATION ANOMALY) for missing receipts, duplicate transitions, stale clients, and unauthorized actions.
4. **Explicit mandatory MVP working path added:** Detailed the 12-step happy-path demonstration and 6-step failure demonstration, strictly defining the ONE controlled network boundary.

## v1.0 $\rightarrow$ v1.1

### 1. Authentication & API Gateway

- **Change:** Mandated Amazon Cognito JWT $\rightarrow$ API Gateway JWT Authorizer, with fine-grained authorization moved explicitly inside Lambda services.
- **Reason:** Standardizes the authentication edge, removes the complexity of custom Lambda Authorizers, and correctly delegates business logic authorization (e.g., verifying asset ownership) to the domain layer.
- **Engineering Impact:** API Gateway configuration is simplified. Lambdas must now extract and validate the JWT claims alongside business rules.

### 2. Custody Integrity Model

- **Change:** Upgraded from a simple "immutable" event log to a **Tamper-Evident** cryptographically chained log (Event N hashes Event N-1).
- **Reason:** DynamoDB is not natively immutable. This ensures historical events cannot be modified without breaking the chain, providing true cryptographic integrity.
- **Engineering Impact:** Requires SHA-256 hashing logic during custody transitions and strict append-only constraints in the application layer.

### 3. Authoritative State vs. EventBridge

- **Change:** Enforced atomic transactional persistence in DynamoDB _before_ domain events are published to EventBridge. EventBridge is explicitly defined as non-authoritative.
- **Reason:** Prevents race conditions and state inconsistencies where downstream consumers act on events that failed to persist in the primary database.
- **Engineering Impact:** Requires DynamoDB conditional writes. Event consumers must be designed for idempotency and duplicate delivery.

### 4. Strict Step Functions Boundaries

- **Change:** Restricted AWS Step Functions usage exclusively to multi-stage, stateful workflows (e.g., anomaly investigation, verification). Prohibited for standard CRUD.
- **Reason:** Prevents architectural bloat, reduces latency, and optimizes costs for simple synchronous API calls.
- **Engineering Impact:** Clear separation between Lambda (sync APIs), EventBridge (async fan-out), and Step Functions (orchestration).

### 5. Offline-First Collector Synchronization

- **Change:** Defined a concrete client-side outbox model (local storage $\rightarrow$ network sync $\rightarrow$ idempotency validation) where the server remains strictly authoritative.
- **Reason:** Replaces vague "service worker caching" with a robust conflict-resolution strategy for field collectors in poor connectivity areas.
- **Engineering Impact:** Requires local persistence (IndexedDB) in the PWA and strict idempotency keys in backend APIs.

### 6. Location / GPS Risk Model

- **Change:** Shifted location anomalies from "automatic irreversible blocks" to "risk signals" requiring admin review.
- **Reason:** GPS is often inaccurate or spoofed. A minor geo-drift should not permanently destroy a legitimate custody chain.
- **Engineering Impact:** Introduces a new Anomaly workflow and admin review UI.

### 7. Commercial Economics Integration

- **Change:** Introduced explicit domain entities for `PartnerTerms`, `Offer`, `Transaction`, and `Settlement` (simulated).
- **Reason:** Acknowledges that informal collectors require economic incentives to participate in authorized networks.
- **Engineering Impact:** Expands the database schema and requires workflows for offer acceptance and settlement status tracking.

### 8. S3 Storage & Evidence Security

- **Change:** Explicitly separated the public Frontend S3 bucket (via CloudFront OAC) from a strictly private Evidence S3 bucket accessed via presigned URLs.
- **Reason:** Prevents public exposure of sensitive custody photos, processing certificates, and potential PII.
- **Engineering Impact:** Requires presigned URL generation APIs and strict least-privilege IAM policies.

### 9. Data-Safety Verification States

- **Change:** Differentiated between `USER_VERIFIED_RESET` (self-attestation) and `PARTNER_VERIFIED_WIPE` (actual sanitization).
- **Reason:** A consumer checking a box does not cryptographically prove data erasure.
- **Engineering Impact:** Adds explicit data sanitization states to the device lifecycle model.

### 10. Expanded Device Lifecycle & Missing Receipts

- **Change:** Expanded the lifecycle to 10 strict states (including `ASSESSED`, `ROUTED`) and introduced a lifecycle for missing receipts (`EXPECTED` $\rightarrow$ `PENDING` $\rightarrow$ `OVERDUE`).
- **Reason:** Models the real-world operational reality where items sit in transit or require assessment before routing.
- **Engineering Impact:** More complex state machine transitions in the backend.

### 11. Expanded Threat Model & Testing Scope

- **Change:** Added specific security considerations (replayed requests, QR tampering) and mandated idempotency and DynamoDB conditional-write testing.
- **Reason:** Hardens the application against expected real-world attack vectors and distributed system failures.
- **Engineering Impact:** Increases the required test coverage (unit, integration, E2E) significantly before deployment.
