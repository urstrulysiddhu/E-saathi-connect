# Phase 7 — Product Experience & Operational UX

This document outlines the UX architecture and product experience for e-Saathi Connect.

## Application Structure

The application is built using React, Vite, and React Router. It functions as a Progressive Web App (PWA) with responsive layouts adapted for Mobile (Consumers & Collectors) and Desktop (Hubs & Destinations).

### Role Journeys & Screen Inventory

#### 1. Consumer Journey (`/consumer`)

Consumers trace the lifecycle of their handed-over e-waste.

- **Home (`/consumer`)**: Lists their registered devices with high-level statuses.
- **Device Registration (`/consumer/register`)**: Captures intent to hand over e-waste, collecting condition and category.
- **Device Details (`/consumer/devices/:deviceId`)**: The "Amazon-style tracking" timeline. Displays verifiable evidence (photos) and current custody states.
- **Photo Upload (`/consumer/devices/:deviceId/upload-photo`)**: Integrates `CameraCapture` and performs authenticated S3 uploads for evidence.

#### 2. Collector Journey (`/collector`)

Optimized for mobile field usage.

- **Home (`/collector`)**: Queue of devices ready for physical handover.
- **Handover UI (`/collector/handover/:deviceId`)**: Collector reviews the device identity, uploads a handover photo as evidence, and confirms the `COLLECT_FROM_CONSUMER` custody transition securely.

#### 3. Hub Journey (`/hub`)

Optimized for tablet/desktop queue management.

- **Home (`/hub`)**: Incoming queue of collected devices pending assessment and routing.
- **Routing Engine (`/hub/routing/:deviceId`)**: Calls the `RoutingEligibilityEngine` to deterministically present eligible destinations based on real network rules (Operational Status, Authorized Facilities, Network Relations). Discloses any applicable Commercial Offers.

#### 4. Destination Journey (`/destination`)

- **Home (`/destination`)**: Displays the facility's queue. Allows marking devices as `PROCESSED`.

#### 5. Admin Journey (`/admin`)

- **Home (`/admin`)**: Exception-oriented dashboard for system administrators. Escalates overdue events, evidence integrity failures, and routing anomalies.

## Authentication & API Abstraction

- **Frontend Isolation**: The frontend establishes an isolated API client (`src/api/client.ts`) utilizing the `authToken` bound to the active session.
- **No Spoofing**: `ProtectedRoute` safely prevents navigating to unauthorized paths. However, real security remains entirely backend-driven via the Cognito JWT and Phase 2's `AuthorizationContext`.
- **Demo Mode**: Because real IAM/Cognito infrastructure is not deployed in Phase 7 locally, a controlled `authApi.devLogin()` development adapter has been safely established.

## Evidence & Camera Integration

- **CameraCapture**: Standardized UI component for snapping/uploading photos natively or via file selection.
- **Direct S3 Pre-signed Uploads**: Implemented properly via the Phase 5 evidence APIs `uploadIntent` and `complete`. It securely pipes binary data directly to the AWS Object storage without traversing the Lambda backend.

## Responsive Strategy & Accessibility

- **Vanilla CSS Architecture**: Built an intentional, performant `index.css` system avoiding heavy runtime libraries, featuring semantic accessible color properties (`--primary-color`, `--danger-color`).
- **Mobile First**: Handover workflows are touch-optimized, vertically stacked, and structured to prevent horizontal overflow.
- **WCAG Compliance**: Inputs enforce proper labels, button contrasts are sufficient, and UI relies on clear text (e.g., "Eligible" / "Ineligible") alongside colors, avoiding color-only indicators.

## PWA Behavior

- `manifest.json` configured in `public/`.
- `index.html` equipped with `theme-color`.

## Known Limitations & Phase 8 Dependencies

- **Offline Sync (Medium)**: The PWA foundation exists, but the persistent offline `IndexedDB` Outbox syncing mechanisms have not been wired yet. Collectors still require connectivity for API custody transitions.
- **Visual Continuity (Low)**: The UI accommodates generic evidence photos, but the actual AWS Rekognition (AI) visual-matching interfaces are disabled intentionally until explicit infrastructure is available.

## Phase 8 Readiness

**READY**
