import { Device, Destination, NetworkRelationship, Offer, EligibilityResult } from '@e-saathi/core';
import { AuthorizationContext } from './identity';

export class RoutingEligibilityService {
  public evaluate(
    device: Device,
    destinations: Destination[],
    relationships: NetworkRelationship[],
    offers: Offer[],
    ctx: AuthorizationContext
  ): {
    results: EligibilityResult[];
    applicableOffers: Offer[];
  } {
    const results: EligibilityResult[] = [];
    const applicableOffers: Offer[] = [];

    // Map relationships by destination
    const allowedDestinationIds = new Set(
      relationships
        .filter((r) => r.status === 'ACTIVE' && r.fromOrganizationId === ctx.organizationId)
        .map((r) => r.toOrganizationId)
    );

    // Deduplicate destinations by destinationId and organizationId
    const seenOrgs = new Set<string>();
    const uniqueDestinations = destinations.filter((d) => {
      const key = `${d.organizationId}#${d.name || ''}`;
      if (seenOrgs.has(key)) return false;
      seenOrgs.add(key);
      return true;
    });

    for (const destination of uniqueDestinations) {
      const reasons: string[] = [];
      const failedRules: string[] = [];

      // Check operational status
      if (destination.operationalStatus !== 'OPERATIONAL') {
        failedRules.push('DESTINATION_NOT_OPERATIONAL');
      } else {
        reasons.push('OPERATIONAL');
      }

      // Check authorization
      if (destination.authorizationStatus !== 'ACTIVE') {
        failedRules.push('DESTINATION_AUTHORIZATION_EXPIRED');
      } else {
        reasons.push('AUTHORIZATION_ACTIVE');
      }

      // Validate dates
      const now = new Date().toISOString();
      if (destination.authorizationValidUntil && destination.authorizationValidUntil < now) {
        failedRules.push('DESTINATION_AUTHORIZATION_EXPIRED');
      } else {
        reasons.push('AUTHORIZATION_VALID');
      }

      // Check accepted categories
      if (!destination.acceptedDeviceCategories.includes(device.category)) {
        failedRules.push('DEVICE_CATEGORY_NOT_ACCEPTED');
      } else {
        reasons.push('CATEGORY_ACCEPTED');
      }

      // Check conditions (optional/MVP simple check)
      if (
        destination.acceptedConditions.length > 0 &&
        device.condition &&
        !destination.acceptedConditions.includes(device.condition)
      ) {
        failedRules.push('CONDITION_NOT_ACCEPTED');
      } else if (device.condition) {
        reasons.push('CONDITION_ACCEPTED');
      }

      // Check relationship
      if (!allowedDestinationIds.has(destination.organizationId)) {
        failedRules.push('NO_ACTIVE_NETWORK_RELATIONSHIP');
      } else {
        reasons.push('ACTIVE_NETWORK_RELATIONSHIP');
      }

      const eligible = failedRules.length === 0;

      results.push({
        destinationId: destination.destinationId,
        organizationId: destination.organizationId,
        destinationName: destination.name,
        destinationType: destination.destinationType,
        authorizationStatus: destination.authorizationStatus,
        authorizationReference: destination.authorizationReference,
        eligible,
        reasons,
        failedRules,
      });

      if (eligible) {
        // Find matching offers
        const matchingOffers = offers.filter(
          (o) =>
            o.status === 'ACTIVE' &&
            o.sourceOrganizationId === ctx.organizationId &&
            o.destinationOrganizationId === destination.organizationId &&
            o.deviceCategory === device.category &&
            o.validUntil >= now
        );
        applicableOffers.push(...matchingOffers);
      }
    }

    return { results, applicableOffers };
  }
}
