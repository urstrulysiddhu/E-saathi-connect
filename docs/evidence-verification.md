# Evidence & Verification (Phase 5)

## 1. Core Principle

"Track less. Prove more."
Evidence is separated into distinct objects securely stored in an S3 bucket, creating isolated boundaries between logical Custody Events (stored in DynamoDB) and the binary supporting evidence artifacts backing those events.

## 2. Evidence Domain Model

- `Evidence`: Opaque identifier (`evidenceId`), linked strictly to a `deviceId`. Features ownership contexts (`capturedByActorId`, `capturedByOrganizationId`) to guarantee that isolated operations remain strictly cross-tenant sealed.
- Support `PENDING_UPLOAD`, `UPLOADED`, `VERIFIED`, `REJECTED`, and `QUARANTINED` states.

## 3. Storage Architecture

- **Service:** Amazon S3
- **Security:** Block Public Access, S3 Managed Encryption, strictly private APIs.
- **Object Key Strategy:** Deterministic opaque isolation: `evidence/{organizationId}/{deviceId}/{evidenceId}.{extension}`. No user-supplied paths prevent traversal attacks.

## 4. Presigned Upload Flow

- Upload intent securely provisions intent vectors within DynamoDB representing expected sizes, expected types, and required metadata limits (`POST /evidence/upload-intent`).
- Lambdas yield ephemeral Pre-signed PUT URLs.
- Direct-to-S3 uploads avoid massive memory loads within lambda invocations and immediately return results.
- `POST /evidence/:evidenceId/complete` strictly validates the S3 `HeadObject` matches the original intent (preventing size modification injections) before graduating status to `UPLOADED`.

## 5. Verification

- `verifyEvidence()` handles automated integrity verification by downloading the stream securely entirely behind the AWS backend layer, parsing exact SHA-256 binary values, and sealing the result against the DB.

## 6. Access Control

- Explicit tenant constraints isolate cross-organizational read access.
- Temporary `GET /evidence/:evidenceId/access` URLs expire after 5 minutes ensuring no permanent access tokens or hardcoded file-access vectors.
- Device Ownership is checked before any operation.

## 7. Camera Capture

- Frontend foundational component supports `<input type="file" accept="image/*" capture="environment">`.

## 8. Visual Continuity & Authentication

- Abstract bounds for Visual Continuity (`VisualContinuitySignal`) exist to support comparison grading (`HIGH/MEDIUM/LOW/UNAVAILABLE`) without conflating signals as legal proofs of AI-based device match boundaries.
- External Integrations (DigiLocker / Aadhaar) represent future integration layers outside the immediate MVP scopes, leveraging generic abstractions to securely map explicit metadata vectors into `EvidenceVerificationResult`.

## 9. Security Implementations

- Enforced limits: 10MB Maximum upload.
- Allowed extensions strictly regulated (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`).
- Pre-checks reject arbitrary path inputs or mismatched sizes.
