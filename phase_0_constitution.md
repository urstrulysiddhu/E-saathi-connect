# Phase 0 Engineering & Product Constitution: e-Saathi Connect

## 1. Product Mission

**Track less. Prove more.**
To make the movement and final disposition of electronic waste transparent, verifiable, and accountable through an evidence-backed digital chain of custody. The platform ensures responsible electronics disposal without relying on blind trust.

## 2. Problem Definition

Consumers lose visibility of their e-waste immediately after handover, creating doubt about data safety and disposal legitimacy. Concurrently, the existing e-waste ecosystem involves a fragmented mix of formal and informal actors. Simply scanning a QR code or logging a transaction does not prove that the chain of custody is complete, authorized, or logically consistent.

## 3. Target Users / Personas

1. **Consumers:** Disposing of old electronics, seeking transparency, assurance of final destination, and verifiable data safety.
2. **Participating Local Collection Partners (Informal/Formal):** Local collectors operating on economic incentives, seeking low-friction workflows to route material to authorized hubs.
3. **Authorized Networks / Aggregators (Hubs):** Organizations consolidating material and managing downstream relationships.
4. **Authorized Destinations (Recyclers/Refurbishers):** Verified facilities capable of responsible processing and data sanitization.
5. **Network Administrators / Compliance Officers:** Managing the ecosystem, monitoring anomalies, and ensuring chain integrity.

## 4. User Journeys

- **Consumer:** Register device $\rightarrow$ complete data safety checklist $\rightarrow$ physical handover $\rightarrow$ track digital custody timeline $\rightarrow$ view final verified disposition.
- **Collector:** Login (PWA) $\rightarrow$ scan device QR $\rightarrow$ accept custody $\rightarrow$ view eligible downstream routes based on commercials/authorizations $\rightarrow$ handover to Hub.
- **Destination:** Receive device $\rightarrow$ verify data sanitization $\rightarrow$ process for refurb/recycling $\rightarrow$ upload evidence $\rightarrow$ close chain.

## 5. Functional Requirements

- Unique Device Passport generation with QR codes.
- Cryptographically sound or evidence-backed chain-of-custody transition engine.
- Document/photo evidence upload linked to specific custody events.
- **Chain Integrity Engine:** Continuous validation of state transitions, identifying anomalies.
- Authorized routing recommendation engine (preventing material flow to unverified endpoints).
- Transparent recording of partner-defined commercial terms.
- Consumer-facing lifecycle tracking UI.
- Admin dashboard for network oversight and exception handling.

## 6. Non-Functional Requirements

- **Reliability:** Idempotent APIs, graceful degradation.
- **Scalability:** AWS Serverless architecture scaling on-demand.
- **Security:** Strict Role-Based Access Control (RBAC), secure API boundaries, PII isolation.
- **Accessibility/Usability:** Mobile-first, responsive PWA for low-friction collector use in the field.
- **Auditability:** Immutable event logs for all custody transfers.
- **Observability:** Structured logging, metrics, and tracing via AWS CloudWatch and X-Ray.

## 7. Core Domain Entities

- **Device (Asset):** The physical electronic item (e.g., smartphone, laptop).
- **Actor:** An individual or organization (Consumer, Collector, Hub, Destination).
- **Custody Event:** A recorded state transition (who, what, where, when, evidence).
- **Destination:** An authorized end-facility with defined processing capabilities.
- **Evidence:** S3-stored proof (photos, receipts, geo-tags) linked to an event.

## 8. Lifecycle / State Machine

1. `CREATED`: Device registered.
2. `HANDED_OVER`: Consumer surrenders control.
3. `COLLECTED`: Collector confirms receipt.
4. `RECEIVED`: Authorized hub accepts device.
5. `ASSESSED`: Condition evaluated (refurbish vs. recycle).
6. `PROCESSED`: Final physical breakdown or refurbishment complete.
7. `CLOSED`: Chain verified and terminated.

## 9. Role and Permission Model

- **Consumer:** View access to owned device timeline; can create initial records.
- **Collector:** Read assigned devices; create handover/receipt events; view own transaction records.
- **Hub/Aggregator:** Receive, aggregate, and route material to destinations.
- **Destination:** Mark devices as processed; upload sanitization/processing evidence.
- **Admin:** Full read access; manage actor verifications; view anomaly alerts; block bad actors.

## 10. API / Domain Boundaries

- **Identity Service:** Auth, roles, actor profiles.
- **Asset Registry:** Passport CRUD, QR generation.
- **Custody Engine:** State transitions, event recording.
- **Verification Engine:** Integrity rules evaluation, anomaly detection.
- **Routing & Commercials:** Destination logic, transaction settlement recording.

## 11. AWS Architecture Proposal

The platform will utilize an AWS-native Serverless architecture:

- **Frontend Delivery:** React/TypeScript PWA hosted on **Amazon S3** & served via **CloudFront**.
- **Auth & IAM:** **Amazon Cognito** (User Pools for RBAC).
- **API Layer:** **Amazon API Gateway** (REST/HTTP APIs).
- **Compute:** **AWS Lambda** (Business logic, isolated per domain boundary).
- **Database:** **Amazon DynamoDB** (Single-table design or tightly bounded multi-table for fast transactional entity lookups).
- **Storage:** **Amazon S3** (Evidence, photos, compliance documents).
- **Event Bus:** **Amazon EventBridge** (Decoupling domain events like `CustodyTransferred`).
- **Workflows:** **AWS Step Functions** (Orchestrating long-running anomaly checks and downstream verification).
- **Messaging:** **Amazon SNS/SQS** (Async processing, Admin anomaly alerts).
- **Observability:** **Amazon CloudWatch** (Logs, metrics, alarms).

## 12. Security Model

- **Auth/Authz:** JWT-based authentication via Cognito; API Gateway Lambda Authorizers enforcing RBAC.
- **Data Protection:** DynamoDB encryption at rest; S3 bucket policies/encryption; TLS in transit.
- **Privacy:** Consumer PII decoupled from the device passport ID to prevent tracking a person based on a device scan.
- **Evidence Integrity:** Immutable event logging to prevent tampering with historical custody claims.

## 13. Data Model Proposal

Core NoSQL structure targeting DynamoDB:

- `Devices`: `device_id`, `category`, `brand`, `serial_hash`, `current_state`, `current_holder`.
- `Actors`: `actor_id`, `role`, `organization_name`, `verification_status`.
- `Events`: `event_id`, `device_id`, `from_actor`, `to_actor`, `event_type`, `evidence_id`, `status`.
- `Destinations`: `destination_id`, `registration_status`, `allowed_categories`.
- `Verification`: `verification_id`, `event_id`, `anomaly_flags`, `integrity_status`.

## 14. Event Model

Key domain events flowing through EventBridge:

- `DeviceRegistered`
- `CustodyTransitionRequested`
- `CustodyTransitionVerified`
- `AnomalyDetected`
- `EvidenceUploaded`
- `ChainClosed`

## 15. Failure Scenarios

1. **Collector App Offline:** PWA Service Worker caches payload, syncs when online. API is strictly idempotent.
2. **Unauthorized Routing Attempt:** Integrity Engine synchronously blocks transition at the API layer, returning a `BLOCKED` status.
3. **Impossible Movement (Time/Distance):** Detected asynchronously via Step Functions/Lambda; flags the device, alerts Admin via SNS, and pauses further transitions.
4. **Broken Chain (Missing Receipt):** Engine flags an incomplete transition if a handover is recorded but not confirmed by the receiver within a timeframe.

## 16. Testing Strategy

- **Unit Testing:** Jest for core Lambda logic, pure functions, and state machine transitions.
- **Integration Testing:** API tests against local AWS SAM or DynamoDB Local.
- **E2E Testing:** Critical user journeys (Consumer $\rightarrow$ Destination) automated via Cypress or Playwright.
- **Failure Injection:** Explicit tests simulating unauthorized hubs, fast geo-movements, and missing receipts to validate the Chain Integrity Engine.

## 17. Repository Architecture

A Monorepo structure is proposed:

```text
/e-saathi-connect
├── apps/
│   └── web-pwa/           # React/Vite/TS Frontend (Role-based views)
├── packages/
│   ├── core/              # Shared domain logic, types, schemas
│   └── ui/                # Shared enterprise React components
├── backend/               # Serverless backend (AWS CDK)
│   ├── src/               # Lambda functions
│   └── infra/             # Infrastructure as Code (CDK Stacks)
└── README.md
```

## 18. Deployment Strategy

- **Infrastructure as Code (IaC):** AWS CDK (TypeScript) for reproducible deployments.
- **CI/CD:** GitHub Actions to run linting, type-checking, and tests.
- **Environments:** Deploy to a dedicated AWS Hackathon account.
- **Configuration:** Secrets managed via AWS Systems Manager Parameter Store / Secrets Manager.

## 19. MVP Scope for the Hackathon

- **Primary Goal:** Track **1 device** through **1 controlled network** (1 consumer, 1 collector, 1 hub, 1 destination, 1 admin) from creation to final disposition.
- **Happy Path:** Create $\rightarrow$ Handover $\rightarrow$ Collect $\rightarrow$ Hub $\rightarrow$ Assess $\rightarrow$ Route $\rightarrow$ Process $\rightarrow$ Verify.
- **Mandatory Failure Demos:**
  1. Unauthorized destination $\rightarrow$ `BLOCKED`
  2. Missing receipt $\rightarrow$ `CHAIN INCOMPLETE`
  3. Impossible movement $\rightarrow$ `LOCATION ANOMALY`
- **UI Deliverables:** Consumer tracking view, Collector PWA workflow, Admin network dashboard.

## 20. Post-MVP Production Roadmap

- Batch Passport for bulk material tracking.
- Producer (EPR) compliance reporting integrations.
- UPI/Banking infrastructure integration for automated settlement payouts.
- AI-assisted evidence inspection (e.g., verifying condition photos).
- Offline-first mesh network syncing for highly remote collection partners.

---

## 🛑 Assumptions Requiring Validation (Before Phase 1)

1. **Unified Frontend:** Is it acceptable to build a single React PWA with role-based routing for all personas (Consumer, Collector, Admin) for the MVP, rather than separate apps?
2. **Mocking External Contexts:** Can we simulate GPS location changes and mock the commercial settlement logic for the demo, rather than using physical device GPS and real payment gateways?
3. **AWS Stack Access:** Do we have sufficient access and permissions in the target AWS account to deploy API Gateway, Cognito, Step Functions, and EventBridge using AWS CDK?

**Status:** Awaiting Product/Engineering Approval to proceed to Phase 1 (Repository Setup & Base Architecture).
