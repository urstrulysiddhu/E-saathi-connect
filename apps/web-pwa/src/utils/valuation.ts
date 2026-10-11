import { DeviceCategory, DeviceCondition } from '@e-saathi/core';

export const CATEGORY_BASE_PRICE: Record<string, number> = {
  MOBILE_PHONE: 4500,
  SMARTPHONE: 6500,
  LAPTOP: 14000,
  DESKTOP: 9500,
  TABLET: 5000,
  TELEVISION: 4500,
  MONITOR: 2500,
  PRINTER: 1500,
  ROUTER: 800,
  SMALL_APPLIANCE: 600,
  LARGE_APPLIANCE: 3500,
  OTHER: 1200,
};

export const REFERENCE_PRICING: Record<string, Record<string, number>> = {
  oneplus: {
    '11': 22000,
    'oneplus 11': 22000,
    '11r': 16000,
    'oneplus 11r': 16000,
    '10 pro': 15000,
    'oneplus 10 pro': 15000,
    '10t': 13000,
    'oneplus 10t': 13000,
    '9 pro': 11000,
    '9': 9000,
    'nord': 6500,
    'nord ce': 5500,
    '8': 7000,
    '7': 4500,
  },
  apple: {
    'iphone 11': 8500,
    'iphone 12': 12000,
    'iphone 13': 18000,
    'iphone 13 pro': 24000,
    'iphone 14': 24000,
    'iphone 14 pro': 32000,
    'iphone 15': 32000,
    'iphone 15 pro max': 48000,
    'macbook pro': 34000,
    'macbook air': 24000,
    'ipad': 9000,
  },
  samsung: {
    'galaxy s20': 6000,
    'galaxy s21': 9500,
    'galaxy s22': 14000,
    'galaxy s23': 20000,
    'galaxy s23 ultra': 35000,
    'galaxy s24': 28000,
    'galaxy z flip': 18000,
    'galaxy z fold': 28000,
    'galaxy a': 5000,
    'galaxy m': 4000,
    'galaxy tab': 7000,
  },
  xiaomi: {
    '13': 16000,
    '12': 11000,
    'redmi note': 5000,
    'redmi': 3500,
  },
  google: {
    'pixel 6': 7500,
    'pixel 7': 12000,
    'pixel 7 pro': 17000,
    'pixel 8': 18000,
    'pixel 8 pro': 26000,
  },
  dell: {
    'xps 13': 18000,
    'xps 15': 24000,
    'latitude': 10000,
    'inspiron': 7500,
    'alienware': 28000,
  },
  hp: {
    'spectre': 18000,
    'envy': 12000,
    'pavilion': 8500,
    'omen': 20000,
  },
  lenovo: {
    'thinkpad': 13000,
    'thinkpad x1': 22000,
    'ideapad': 7000,
    'legion': 22000,
  },
  asus: {
    'rog': 22000,
    'zenbook': 15000,
    'vivobook': 8000,
  },
};

export const CONDITION_MULTIPLIER: Record<string, number> = {
  WORKING: 1.0,           // Fully functional, refurbishable / resalable
  USED: 0.75,              // Fully working with normal cosmetic wear
  PARTIALLY_WORKING: 0.60, // Minor functional defects, repairable components
  NOT_WORKING: 0.30,       // Non-bootable / mainboard fault, component salvage
  DAMAGED: 0.18,           // Cracked screen/chassis, raw parts recovery
  FOR_PARTS: 0.08,         // Severe loss / scrap material recovery
  UNKNOWN: 0.35,           // Conservative untested default
};

export function calculateIndicativeValuation(
  category: DeviceCategory | string,
  condition: DeviceCondition | string = 'WORKING',
  brand = '',
  model = ''
): { min: number; max: number; status: 'ESTIMATED'; currency: 'INR'; basis: string } {
  let normBrand = brand.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normBrand.includes('oneplus') || normBrand === 'oneplus' || normBrand === '1+') {
    normBrand = 'oneplus';
  }

  const rawModel = model.trim().toLowerCase();
  const normCat = (category || 'MOBILE_PHONE').trim().toUpperCase();

  let basePrice: number | null = null;
  let matchedBasis = 'Category benchmark';

  if (normBrand && rawModel && REFERENCE_PRICING[normBrand]) {
    const brandModels = REFERENCE_PRICING[normBrand];
    for (const [mName, price] of Object.entries(brandModels)) {
      if (rawModel.includes(mName) || mName.includes(rawModel)) {
        basePrice = price;
        matchedBasis = `${brand} ${mName} market benchmark`;
        break;
      }
    }
  }

  // Also check if model field contains the brand name, e.g. brand="OnePlus", model="OnePlus 11"
  if (!basePrice && (rawModel.includes('oneplus') || rawModel.includes('1+'))) {
    const oneplusModels = REFERENCE_PRICING['oneplus'];
    for (const [mName, price] of Object.entries(oneplusModels)) {
      if (rawModel.includes(mName)) {
        basePrice = price;
        matchedBasis = `OnePlus ${mName} market benchmark`;
        break;
      }
    }
  }

  if (!basePrice) {
    basePrice = CATEGORY_BASE_PRICE[normCat] || 1200;
    matchedBasis = `${normCat.replace(/_/g, ' ')} base benchmark`;
  }

  const multiplier = CONDITION_MULTIPLIER[condition] ?? 0.35;
  const estimated = Math.round(basePrice * multiplier);
  const min = Math.max(100, Math.round(estimated * 0.8));
  const max = Math.max(min + 100, Math.round(estimated * 1.2));

  return { min, max, status: 'ESTIMATED', currency: 'INR', basis: matchedBasis };
}


