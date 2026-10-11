# Device Registry Architecture

## 1. Device Domain Model

The `Device` acts as the single source of truth for the physical e-waste asset across all phases. It establishes unique identifiers, physical characteristics, explicit organization ownership, and standard lifecycle/data safety defaults (starts as `CREATED` and `NOT_VERIFIED`).

## 2. State Ownership

- **Device Registry** owns identity, category, identifiers, and ownership definition.
- **Custody Engine (Future)** owns `lifecycleState` and `currentCustodianOrganizationId`.
- The Registry provides the state container, but forbids modifying state fields directly via normal `/devices` endpoints.

## 3. DynamoDB Design

The design uses a single-table inspired access pattern approach, but separated cleanly for Devices:

- `PK`: `DEVICE#<deviceId>`
- `SK`: `DEVICE#<deviceId>`
- `GSI1PK`: `ORG#<organizationId>`
- `GSI1SK`: `DEVICE#<createdAt>`

## 4. Access Patterns

- **Get by ID**: Uses the base table PK/SK for fast key-value lookups.
- **List by Organization**: Uses `GSI1` to fetch organization-scoped devices sorted chronologically (using `createdAt` as SK allows for date-based retrieval and stable ordering).

## 5. Repository Boundary

DynamoDB logic is encapsulated in `DeviceRepository`. The `DeviceService` layer handles authorization contexts and business validation before invoking repository interfaces, isolating SDK dependencies.

## 6. Authorization Boundary

Operations are strictly fenced using the `AuthorizationContext` (from Phase 2). Reads across organizational lines are rejected unless the actor explicitly carries the `ADMIN` role. Creating devices inherently binds to the decoded organizational token claims rather than client bodies.

## 7. Version/Concurrency Strategy

Optimistic concurrency is strictly enforced via an incrementing `version` attribute and `ConditionExpression` attributes. Concurrent stale updates reject natively with HTTP 409 Conflicts.

## 8. Idempotency Strategy

Creation utilizes `IDEMPOTENCY#<orgId>#<key>` items with a 24-hour TTL inside the Dynamo table to reject network retries resulting in duplicate asset identity instantiation.

## 9. Privacy Considerations

Fields like `imei` and `serialNumber` are not fully logged by `logger.ts` internally, protecting potentially sensitive manufacturer metadata from leakage into observability pipelines.

## 10. Cost Considerations

- Table provisions via `PAY_PER_REQUEST` to maintain $0 standing charge.
- AWS-managed encryption avoids custom KMS costs.
- Global tables and PITR are skipped for hackathon frugality.
