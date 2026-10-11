# Phase 0 Engineering & Product Constitution: e-Saathi Connect (v1.2)

## 1. Product Principle & Mission

**Track less. Prove more.**
e-Saathi Connect is a production-oriented cloud-native e-waste traceability and collection-network platform. It is not a visual hackathon mockup.
The system models a credible operational workflow: **CONSUMER $\rightarrow$ PARTICIPATING LOCAL COLLECTION PARTNER $\rightarrow$ AUTHORIZED NETWORK / HUB $\rightarrow$ FORMAL RECYCLER OR REFURBISHER $\rightarrow$ VERIFIED FINAL DESTINATION**.
The platform does not assume that every informal collector in India is formalized. Instead, it enables an authorized network to onboard participating local collection partners and manage their interactions with downstream destinations. Crucially, the product preserves economic incentives rather than assuming collectors will sacrifice income purely for environmental benefit.

## 2. Non-Negotiable Engineering Principle

The application must be designed as if it could be deployed to production immediately after the hackathon.
Every major architectural decision must answer:

1. Why is this needed?
2. What failure does it prevent?
3. Why this AWS service?
4. What happens when the service fails?
5. What happens when the network is offline?
6. What happens if the same request is submitted twice?
7. Who is authorized to perform the operation?
8. What data is exposed?
9. How is the operation audited?
10. How can the operation be tested?

Infrastructure must not be added simply to increase the number of AWS services used.

## 3. Architecture & Authentication Corrections

**Authentication & API Gateway:**

- **Amazon Cognito** $\rightarrow$ JWT access token $\rightarrow$ **API Gateway HTTP API** $\rightarrow$ API Gateway JWT authorizer $\rightarrow$ **AWS Lambda**.
- Custom Lambda authorizers will NOT be used unless a concrete requirement proves the native JWT authorizer cannot satisfy it.
- Authentication is handled by Cognito and API Gateway. Fine-grained business authorization (e.g., verifying a collector belongs to a specific organization or a consumer owns a device) is explicitly performed inside application services (Lambdas).

## 4. Custody Integrity Model

The custody event log must be **Tamper-EVIDENT**, explicitly distinguishing between database mutability, application authorization, tamper evidence, and cryptographic integrity. We do not falsely claim DynamoDB itself is immutable.

- Events are **append-only** from the application perspective. Ordinary actors cannot modify historical events.
- Each event cryptographically links to the previous one to create a verifiable chain: `Event N` references the hash of `Event N-1` and produces its own hash.
- Required Event attributes for integrity: `eventId`, `deviceId`, `eventType`, `actorId`, `fromActorId`, `toActorId`, `timestamp`, `location` (evidence where available), `evidence references`, `previousEventHash`, `eventPayloadHash`, `eventHash`, `authorization context`, `idempotency key`.

## 5. Authoritative State vs. Domain Events

The authoritative custody transition must be committed transactionally before asynchronous event distribution.
**Preferred Flow:** API Request $\rightarrow$ Authentication $\rightarrow$ Authorization $\rightarrow$ Validate Transition $\rightarrow$ Atomic Persistence / Conditional Write in DynamoDB $\rightarrow$ Append Custody Event $\rightarrow$ Update Current Device State $\rightarrow$ Publish Domain Event to EventBridge.

- **EventBridge is not the authoritative source of state.**
- Design for duplicate event delivery. Consumers must be idempotent.
- Use explicit idempotency keys for state-changing APIs and DynamoDB conditional writes/transactions to prevent conflicting state transitions.

## 6. EventBridge & Event Model

Amazon EventBridge is the domain-event distribution layer.

- **Initial Events:** `DeviceRegistered`, `CustodyTransitionRequested`, `CustodyTransitionVerified`, `EvidenceUploaded`, `AnomalyDetected`, `ChainClosed`.
- **Consistent Event Envelope:** `eventId`, `eventType`, `eventVersion`, `occurredAt`, `producer`, `correlationId`, `deviceId` (if applicable), `actorId` (if applicable), `payload`.
- Critical event consumers must be configured with retry handling and Dead-Letter Queues (DLQs). Failed asynchronous events must never silently disappear.

## 7. Step Functions

AWS Step Functions are **NOT** for ordinary CRUD operations. They are strictly reserved for stateful, multi-step workflows.

- **Valid Use Cases:** Anomaly investigation workflows, downstream verification orchestration, chain closure verification, and multi-stage exception handling.
- **Clear Distinction:** We distinguish between Synchronous API operations (Lambda), Asynchronous event processing (EventBridge/SQS), and Long-running workflow orchestration (Step Functions).

## 8. Offline-First Collector Model

The collector workflow explicitly supports intermittent connectivity via a client-side outbox model.

- **Flow:** Collector action $\rightarrow$ Local pending event $\rightarrow$ Persistent local storage (IndexedDB) $\rightarrow$ Network availability $\rightarrow$ Sync $\rightarrow$ Server-side authentication $\rightarrow$ Idempotency validation $\rightarrow$ Server-side transition validation $\rightarrow$ Successful persistence $\rightarrow$ Local event marked synchronized.
- **Conflict Handling:** The server remains strictly authoritative. Offline synchronization must never allow stale client state to overwrite a newer server state.

## 9. Location / GPS Model

Location is supporting evidence, not absolute truth.

- The system explicitly distinguishes between: real browser/device geolocation, manually selected location, demo simulation mode, and unavailable location.
- Simulated GPS (for demo purposes) must be marked as such and never presented as real-world sensor evidence.
- **Anomaly Handling:** A location anomaly produces a **risk signal**, not an automatic irreversible block or accusation of fraud. It routes to admin review or a policy decision.

## 10. Commercial / Collector Economics

The system models the actual commercial workflow without executing real payments for the MVP. Universal pricing or payment guarantees are not claimed; terms are defined by partners.

- **Core Concepts:** `PartnerTerms`, `Offer`, `Transaction`, `Settlement`, `SettlementStatus`.
- **Workflow:** Device assessed $\rightarrow$ Eligible destination $\rightarrow$ Partner-defined offer $\rightarrow$ Collector accepts $\rightarrow$ Transaction recorded $\rightarrow$ Settlement pending $\rightarrow$ Settlement recorded (simulated for MVP).

## 11. S3 Storage Model

Clear separation between frontend hosting and private data:

- **Frontend Assets:** Amazon S3 $\rightarrow$ Amazon CloudFront (with Origin Access Control) $\rightarrow$ React PWA.
- **Private Evidence Storage:** Application $\rightarrow$ Authorized upload mechanism (e.g., presigned URLs) $\rightarrow$ Private S3 Evidence Bucket. Evidence is never publicly readable. Access uses least-privilege IAM policies.

## 12. Evidence & Data-Safety Models

**Evidence Model:**

- Types: Custody photos, receipts, condition images, processing certificates, sanitization evidence.
- An uploaded photo supports verification but does not automatically prove a physical event occurred.
- Evidence Object Metadata: `evidenceId`, `deviceId`, `eventId`, `uploader`, `organization`, `timestamp`, `evidenceType`, `storageKey`, `integrityMetadata`.

**Data-Safety Model:**

- The platform does not claim cryptographic proof of secure deletion unless explicitly implemented.
- Explicit states: `USER_VERIFIED_RESET` (self-attestation), `PARTNER_VERIFIED_WIPE` (partner verification), `NOT_VERIFIED`.

## 13. Anomaly & Missing Receipt Models

**Anomaly Model:**

- Detection must be explainable. Risk flags $\neq$ confirmed fraud.
- Types: Unauthorized destination, invalid state transition, duplicate custody event, missing expected receipt, impossible/implausible movement, expired destination authorization, duplicate device registration.
- Anomaly Metadata: `anomalyId`, `type`, `severity`, `deviceId`, `detectedAt`, `reason`, `supportingEvidence`, `status`, `reviewer`, `resolution`.

**Missing Receipt Model:**

- A missing receipt is not immediately a broken chain.
- Lifecycle: `EXPECTED` $\rightarrow$ `PENDING` $\rightarrow$ `OVERDUE` $\rightarrow$ `ESCALATED` $\rightarrow$ `RESOLVED / CONFIRMED_EXCEPTION`. Thresholds are configurable.

## 14. Authorized Destination Model

Routing must never recommend a destination that is ineligible for the device/category or unauthorized.

- Destination explicitly defines: `destinationId`, `organizationId`, `verificationStatus`, `capabilities`, `acceptedCategories`, `authorizationMetadata`, `authorizationValidity`, `operationalStatus`.

## 15. Domain Model & Device Lifecycle

**Expanded Entities:** Consumer, Actor, Organization, CollectionPartner, Hub, Destination, Device, DevicePassport, CustodyEvent, Evidence, Verification, Offer, PartnerTerms, Transaction, Settlement, Anomaly, Notification.

**Device Lifecycle:**
The canonical lifecycle is:
`CREATED` $\rightarrow$ `HANDED_OVER` $\rightarrow$ `COLLECTED` $\rightarrow$ `RECEIVED` $\rightarrow$ `ASSESSED` $\rightarrow$ `ROUTED` $\rightarrow$ `PROCESSING` $\rightarrow$ `PROCESSED` $\rightarrow$ `VERIFIED` $\rightarrow$ `CLOSED`

### Explicit Lifecycle Transition Matrix

**CREATED $\rightarrow$ HANDED_OVER**

- **Actor:** Consumer
- **Meaning:** Consumer has physically handed the device to the participating collection partner.
- **Required evidence:** Consumer handover confirmation and timestamp.
- **Rules:**
  - Device must exist and be owned/controlled by the consumer.
  - Consumer must explicitly confirm handover.
  - Device cannot simultaneously be in another active custody state.

**HANDED_OVER $\rightarrow$ COLLECTED**

- **Actor:** Collector
- **Meaning:** Collector physically accepts custody.
- **Required evidence:** Collector confirmation, timestamp, location evidence where available.
- **Rules:**
  - Collector must be an authorized participating partner.
  - Collector must be eligible to receive this device/category.
  - Idempotency/replay protection required.

**COLLECTED $\rightarrow$ RECEIVED**

- **Actor:** Hub / Aggregator
- **Meaning:** Authorized hub confirms physical receipt from collector.
- **Required evidence:** Receiving confirmation and receipt evidence.
- **Rules:**
  - Hub must be authorized.
  - Expected sender/receiver relationship must be valid.
  - Missing receipt logic must be initiated if the receiving confirmation does not arrive within the defined timeframe.

**RECEIVED $\rightarrow$ ASSESSED**

- **Actor:** Hub / authorized assessor
- **Meaning:** Device condition and disposition suitability are evaluated.
- **Required evidence:** Assessment record.
- **Rules:**
  - Device must currently be held by the authorized hub.
  - Assessment must determine relevant disposition characteristics such as refurbish/recycle suitability and category.

**ASSESSED $\rightarrow$ ROUTED**

- **Actor:** Hub / authorized routing actor
- **Meaning:** A valid downstream destination is selected.
- **Required evidence:** Routing decision and selected destination.
- **Rules:**
  - Destination MUST satisfy: authorization status, authorization validity, capability requirements, accepted category, and operational status.
  - Unauthorized or ineligible destinations MUST be blocked.
  - Commercial terms may influence the recommendation, but authorization and capability are mandatory constraints.

**ROUTED $\rightarrow$ PROCESSING**

- **Actor:** Authorized destination
- **Meaning:** Destination accepts custody and begins processing.
- **Required evidence:** Destination acceptance / receipt confirmation.
- **Rules:**
  - Destination must be the authorized destination selected for the route.
  - Any mismatch must be treated as an exception/anomaly.

**PROCESSING $\rightarrow$ PROCESSED**

- **Actor:** Authorized destination
- **Meaning:** Physical refurbishment/recycling processing has been completed.
- **Required evidence:** Processing evidence.
  - _For refurbishment:_ record refurbishment/disposition outcome.
  - _For recycling:_ record relevant processing outcome.

**PROCESSED $\rightarrow$ VERIFIED**

- **Actor:** Authorized destination and/or verification workflow
- **Meaning:** Required evidence and processing claims have passed the defined verification checks.
- **Required evidence:** Processing evidence and verification record.
- **Rules:**
  - Data-safety state must remain explicitly distinguishable (`USER_VERIFIED_RESET`, `PARTNER_VERIFIED_WIPE`, `NOT_VERIFIED`).
  - Do not claim cryptographic proof unless an actual proof mechanism exists.

**VERIFIED $\rightarrow$ CLOSED**

- **Actor:** Authorized verification authority / Admin / defined closure workflow
- **Meaning:** Chain has satisfied closure requirements.
- **Required evidence:** Final verification record.
- **Rules:**
  - No unresolved critical anomaly.
  - Required custody events exist.
  - Required evidence exists.
  - Destination is authorized.
  - Required exception workflows are resolved or explicitly recorded as CONFIRMED_EXCEPTION.
  - Final disposition is recorded.

### Invalid Transitions

Arbitrary state jumps are rejected. Examples include:

- `CREATED` $\rightarrow$ `PROCESSED`
- `COLLECTED` $\rightarrow$ `CLOSED`
- `HANDED_OVER` $\rightarrow$ `ROUTED`
- `ROUTED` $\rightarrow$ `CLOSED`
  These must not be accepted merely because a caller requests them. The server-side custody engine is strictly authoritative.

### Failure / Exception Behavior

We do not silently overwrite state.

- **Unauthorized destination:** BLOCKED
- **Duplicate/replayed transition:** REJECTED / IDEMPOTENT RESPONSE
- **Impossible movement:** LOCATION ANOMALY risk signal
- **Missing receiver confirmation:** EXPECTED $\rightarrow$ PENDING $\rightarrow$ OVERDUE $\rightarrow$ ESCALATED $\rightarrow$ RESOLVED / CONFIRMED_EXCEPTION
- **Invalid actor:** BLOCKED
- **Invalid lifecycle transition:** REJECTED
- **Missing required evidence:** BLOCKED or PENDING depending on the transition
- **Cross-organization unauthorized action:** BLOCKED
- **Stale client state:** REJECTED and client must reconcile with authoritative server state

## 16. AWS Architecture

- **Frontend:** React + TypeScript PWA $\rightarrow$ CloudFront $\rightarrow$ private S3 frontend origin.
- **API:** Cognito $\rightarrow$ API Gateway HTTP API + JWT authorization $\rightarrow$ Lambda domain services $\rightarrow$ DynamoDB & S3 evidence.
- **Async:** Lambda domain operations $\rightarrow$ EventBridge $\rightarrow$ asynchronous consumers $\rightarrow$ SQS/DLQ.
- **Workflows:** Step Functions (long-running/multi-stage).
- **Notifications:** SNS.
- **Observability:** CloudWatch (logs, metrics, alarms). Evaluate X-Ray tracing.
- _No unnecessary VPC infrastructure for the serverless MVP._

## 17. Security

- **Requirements:** Least-privilege IAM, Cognito Auth, explicit RBAC, organization-level authorization, TLS, encryption at rest, private evidence storage, environment-specific configs, input validation, request size limits, audit logging, secure error responses, PII minimization (separate consumer identity from device passports). No secrets in source code.
- **Threat Considerations:** QR tampering, replayed requests, duplicate submissions, unauthorized custody transfer, forged evidence, cross-organization access, privilege escalation, malicious file uploads.

## 18. Testing Strategy

- Unit & Integration tests.
- API authorization tests.
- Idempotency & DynamoDB conditional-write tests.
- State transition, event processing, and offline synchronization tests.
- **E2E Tests:** Happy path, unauthorized path, missing receipt path, anomaly path.

## 19. MVP Boundary & Demo Proof Points

The MVP must demonstrate the complete mandatory working path:
**CONSUMER $\rightarrow$ COLLECTOR $\rightarrow$ HUB $\rightarrow$ AUTHORIZED DESTINATION $\rightarrow$ PROCESSING $\rightarrow$ VERIFICATION $\rightarrow$ CLOSURE**

**MVP Architectural Constraints:**

- The MVP represents **ONE controlled network**.
- It uses **one representative device**.
- It contains exactly **one consumer, one participating collector, one hub, one authorized destination, and one admin/verification authority**.
- The architecture remains multi-tenant/multi-actor capable, even though the demo uses one controlled network.
- Every custody transition is persisted through the authoritative backend.
- The consumer can see the resulting custody timeline.
- The admin can inspect anomalies and exceptions.

**Mandatory Happy-Path Demonstration:**

1. Consumer registers device.
2. Consumer completes data-safety declaration.
3. Consumer hands device to collector.
4. Collector accepts custody.
5. Hub receives device.
6. Hub assesses device.
7. Hub selects an authorized destination.
8. Destination accepts the route and begins processing.
9. Destination records processing outcome.
10. Verification workflow checks the chain/evidence.
11. Chain is closed.
12. Consumer sees final verified disposition.

**Mandatory Failure Demonstrations:**

1. Unauthorized destination $\rightarrow$ BLOCKED
2. Duplicate/replay transition $\rightarrow$ REJECTED / IDEMPOTENT
3. Missing receipt $\rightarrow$ exception workflow
4. Impossible movement $\rightarrow$ LOCATION ANOMALY
5. Evidence missing/invalid $\rightarrow$ transition blocked or exception
6. Cross-organization unauthorized action $\rightarrow$ BLOCKED
