# Custody Engine Architecture (Phase 4)

## 1. Custody Domain

The Custody Engine controls the lifecycle of a `Device` as it moves across organizations. It separates physical intent (Handover) from logical confirmation (Acceptance/Receipt).

## 2. Transition Matrix

Transitions are explicitly mapped to canonical paths. Forward-only progressions ensure no arbitrary states are applied out-of-order. `validateTransition` maps `LifecycleState` + `CustodyEventType` to the explicit outcome.

## 3. Actor Responsibility Matrix

Roles are strictly bounded to their operational domain.

- `CONSUMER`: Can initiate handovers from `CREATED`.
- `COLLECTOR`: Can accept handovers (`COLLECTED`).
- `HUB`: Receives, assesses, and routes.
- `DESTINATION`: Starts and completes processing.
- `ADMIN`: Verifies and closes the loop.

## 4. Custody Event Schema

Each transition appends a `CustodyEvent` containing payload hashes, references to expected evidence, geographical boundaries (`locationEvidence`), and structural references to organizational boundaries.

## 5. Event Hash Strategy

A cryptographically secure logical hash chain links events together in DynamoDB.
`eventHash = SHA256(H(canonical_payload) + previousEventHash)`

## 6. Append-Only Semantics

Events are strictly appended. Normal operations do not permit `PATCH` or `DELETE` endpoints for existing events.

## 7. DynamoDB Design

- **Table**: `ESaathiDevicesTable`
- **Device Record**: `PK = DEVICE#<deviceId>`, `SK = DEVICE#<deviceId>`
- **Event Record**: `PK = DEVICE#<deviceId>`, `SK = EVENT#<occurredAt>#<eventId>`
- **Idempotency Record**: `PK = IDEMPOTENCY#<orgId>#<key>`, `SK = IDEMPOTENCY#<orgId>#<key>`

## 8. Transaction Strategy

Transitions are natively atomic utilizing DynamoDB `TransactWriteItems`. If an event fails to serialize, the device lifecycle remains unmodified. If a device version is stale, the transaction rejects cleanly.

## 9. Idempotency

Clients map request identifiers directly to unique Dynamo items (`ttl = 24 hours`). Duplicate payload delivery is short-circuited entirely without invoking downstream hashing capabilities.

## 10. Optimistic Concurrency

`expectedVersion` prevents racing transitions. E.g., Collector A and Collector B both click "Accept" concurrently on a consumer's device. One transaction commits, the other reverts (`409 Conflict`).

## 11. Evidence Hooks

`EvidenceReference` payloads are stubbed cleanly for Phase 5. Events capture logical reference schemas ready for deep S3 hook integrations. Location evidence is persisted contextually without mandating strict bounds that block offline workflows.

## 12. Security Model

Organizational spoofing is natively rejected. Payloads asserting target organizations are safely overridden or verified directly against the `AuthorizationContext`. Role-overrides reject immediately without loading database schemas.

## 13. EventBridge Boundary

DynamoDB remains the source of truth. Future integrations will stream out changes sequentially utilizing DynamoDB Streams -> EventBridge, maintaining operational integrity regardless of lambda execution failures.
