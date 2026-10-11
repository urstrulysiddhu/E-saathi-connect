import { IndicativeValuation, DeviceCondition, calculateIndicativeValuation } from '@e-saathi/core';

export class ValuationService {
  getValuation(brand?: string, model?: string, condition?: DeviceCondition, category?: string): IndicativeValuation {
    const result = calculateIndicativeValuation(
      category || 'MOBILE_PHONE',
      condition || 'UNKNOWN',
      brand || '',
      model || ''
    );

    return {
      status: 'ESTIMATED',
      rangeMin: result.min,
      rangeMax: result.max,
      currency: 'INR',
      inputCondition: (condition || 'UNKNOWN') as DeviceCondition,
      pricingRuleVersion: 'v2.1.0-inr-market-rules',
      basis: result.basis,
      timestamp: new Date().toISOString(),
    };
  }
}

