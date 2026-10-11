# e-Saathi Connect (Phase 1)

e-Saathi Connect is a production-grade cloud-native e-waste traceability and collection-network platform.
Current Phase: Phase 1 - Repository Setup & Base Architecture.

## Architecture

The platform is built on AWS:

- Frontend: React / Vite PWA (TypeScript)
- Backend: AWS Lambda + API Gateway (TypeScript)
- Infrastructure as Code: AWS CDK v2
- DB & Storage: DynamoDB, S3
- Orchestration: EventBridge, Step Functions

For details, see [docs/architecture.md](docs/architecture.md).

## Repository Structure

```
/e-saathi-connect
├── apps/web-pwa         # React/Vite application
├── packages/core        # Shared domain models and interfaces
├── packages/ui          # Shared UI components
└── backend/             # Serverless backend and CDK infrastructure
```

## Local Setup

Prerequisites: Node v22.x, npm.

1. Clone repository
2. Run `npm run install:all`
3. Run `npm run validate` to ensure quality checks pass.

## Available Commands

- `npm run install:all`: Install all dependencies across workspaces.
- `npm run build`: Build all packages.
- `npm run typecheck`: Run TS strict compiler checks.
- `npm run lint`: Run ESLint.
- `npm run format:check`: Check code formatting with Prettier.
- `npm run test`: Run Jest unit tests.
- `npm run cdk:synth`: Synthesize CDK templates.
- `npm run validate`: Run format, lint, typecheck, test, and synth.

## Environment Configuration

- Build-time frontend configs are safe to expose.
- Runtime backend configs belong in SSM/Secrets Manager.
- The default AWS region for this application is `ap-south-1`.

## Deployment Strategy

AWS CDK is used for infrastructure as code. Do not deploy manually. CI/CD pipelines will handle automated deployments once infrastructure is fully tested.
