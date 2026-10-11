# Phase 6: Routing and Commercial Network Engine

## 1. Domain Model Overview

Phase 6 implements the digital tracing of destination eligibility, custody routing execution, and associated commercial settlements. It transitions e-Saathi Connect from a pure physical custody ledger into a formal logistical operations platform bridging informal collectors with verified networks.

### 1.1 Destinations (`DestinationNode`)

- Destinations represent physical endpoint facilities (Recyclers, Refurbishers).
- They encode **Authorization Status** and operational capabilities.

### 1.2 Network Relationships

- `NetworkRelationship` encodes the legal, active bonds allowing transfers (e.g. `COLLECTION_TO_HUB`). A route is physically invalid without a supporting formal relationship.

### 1.3 Routing Decisions

- The `RoutingEligibilityService` ingests a `Device` context paired with candidate `Destinations`. It filters deterministically against constraints.
- `RoutingDecision` objects immutably snapshot the chosen route, referencing the eligibility rules satisfied at the exact moment of route generation.

### 1.4 Commercial Engine

- **PartnerTerms**: Macro-level contractual scaffolding (e.g., Fixed Fee, Category-based RevShare).
- **Offer**: Micro-level actionable bids bound by explicit device constraints (e.g., 1500 INR for a WORKING MOBILE).
- **CommercialTransaction**: Acceptance of an active `Offer` bound to a specific `deviceId`. Locks the financial `agreedAmount` historically regardless of future Offer updates.
- **Settlement**: Represents the flow of simulated funds terminating the transaction state machine.

## 2. Eligibility Determinism

The engine provides transparent "why" mechanics, returning an `EligibilityResult` array.
_Reasons_ might include `AUTHORIZATION_ACTIVE`, `OPERATIONAL`, `CONDITION_ACCEPTED`.
_Failed Rules_ return arrays capturing misses like `DESTINATION_AUTHORIZATION_EXPIRED` or `NO_ACTIVE_NETWORK_RELATIONSHIP`.

## 3. Separation of Concerns (Custody vs. Routing)

Creating a `RoutingDecision` **does NOT** trigger a Custody lifecycle. Routing is an intentional logistical plan. Custody remains the authoritative execution model logged directly against the Device Registry.

## 4. End-to-End Example Flow

1. **Consumer** hands over device.
2. **Collector** registers physical possession (`HANDED_OVER`).
3. **Collector** calls `GET /devices/{deviceId}/routing/options`.
   - Engine returns `Eligible` to `ReNova Refurbishment Centre` based on `ACTIVE` relationships and matching capabilities.
4. **Collector** creates `RoutingDecision` selecting `ReNova` along with accepting `Offer#789`.
5. **CommercialTransaction** spawned at agreed `1500 INR`.
6. Hub/Collector executes physical handovers via Phase 4 APIs.
7. Upon processing completion, `Settlement` is instantiated and `SIMULATED` internally.

## 5. Security and Cross-Tenant Restrictions

- Organization boundaries are strictly isolated within DynamoDB access operations via `AuthorizationContext` (JWT claims).
- No Organization can forge relationships with others without bilateral token authority or `admin:manage` override hooks.
- Operations block modification on Expired assets, ensuring chronological integrity matching physical reality.

## 6. Known Limitations

- Settlements are purely simulated. Payment gateway integrations (Razorpay, Stripe) remain out of scope.
- Pricing engines use primitive category checking rather than advanced ML grade-rating.
- Global Index queries currently fallback to scan-like prefix filters for MVP demonstration speeds due to single-table generic partition design constraints.

## 7. Future Hardening

- Complete external CPCB/EPR Government API checks against the `authorizationReference` strings to fully automate destination compliance without human-in-the-loop validation overhead.
- Enable step-functions to handle staggered multi-leg settlement logic during direct `COLLECTION_TO_DESTINATION` bypass runs.
