# e-Saathi Connect Security Principles

## Secret Handling

- Secrets MUST NOT be embedded in source code, `.env` files checked into Git, or frontend artifacts.
- Backend configuration must use AWS Systems Manager Parameter Store or AWS Secrets Manager.
- `VITE_` prefixed environment variables are public and must not contain any sensitive keys or backend credentials.

## Authentication & Authorization

- All user interactions are authenticated via Amazon Cognito.
- Fine-grained authorization is enforced at the domain layer within Lambdas.
- Organization-level isolation is strictly enforced to prevent cross-organization access.
- API requests must contain a valid JWT and are evaluated using the principle of least privilege.

## PII Minimization

- The system minimizes Personally Identifiable Information (PII).
- Consumer identity is decoupled from public device passport identifiers.

## Evidence Security

- Custody evidence (photos, documents) is stored in private S3 buckets.
- Uploads and downloads are facilitated exclusively via short-lived presigned URLs.
- Evidence is not publicly indexable or readable.

## Reporting Vulnerabilities

If a vulnerability is found in the e-Saathi platform, please coordinate with the repository administrators or the assigned compliance officer. Do not publicly disclose before a patch is deployed.
