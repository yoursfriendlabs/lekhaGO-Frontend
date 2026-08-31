export const JEWELLERY_ATTRIBUTE_KEYS = [
  'metalType',
  'metalPurity',
  'actualWeight',
  'wastagePercent',
  'wastageWeight',
  'totalWeight',
  'diamondType',
  'diamondWeight',
  'diamondCarat',
  'diamondPurity',
  'diamondCharge',
  'additionalTax',
];

export const METAL_TYPE_OPTIONS = [
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'platinum', label: 'Platinum' },
  { value: 'other', label: 'Other' },
];

const PURITY_OPTIONS_BY_METAL = {
  gold: ['24K', '22K', '21K', '18K', '14K'],
  silver: ['999', '975', '925', '900'],
  platinum: ['950', '900'],
};

const trimText = (value) => String(value || '').trim();

const formatNumberString = (value, digits = 3) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '';
  return parsed.toFixed(digits).replace(/\.?0+$/, '');
};

export function toJewelleryNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getPurityOptionsForMetal(metalType) {
  return PURITY_OPTIONS_BY_METAL[String(metalType || '').trim().toLowerCase()] || [];
}

export function normalizeJewelleryAttributes(raw = {}) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const preserved = Object.fromEntries(
    Object.entries(source).filter(([key]) => !JEWELLERY_ATTRIBUTE_KEYS.includes(key))
  );

  const actualWeight = trimText(source.actualWeight);
  const wastagePercent = trimText(source.wastagePercent);
  const actualWeightNumber = actualWeight === '' ? null : Number(actualWeight);
  const wastagePercentNumber = wastagePercent === '' ? null : Number(wastagePercent);

  let wastageWeight = trimText(source.wastageWeight);
  let totalWeight = trimText(source.totalWeight);

  if (Number.isFinite(actualWeightNumber) && Number.isFinite(wastagePercentNumber)) {
    wastageWeight = formatNumberString((actualWeightNumber * wastagePercentNumber) / 100, 3);
    totalWeight = formatNumberString(actualWeightNumber + Number(wastageWeight || 0), 3);
  } else {
    wastageWeight = wastageWeight ? formatNumberString(wastageWeight, 3) : '';
    totalWeight = totalWeight ? formatNumberString(totalWeight, 3) : '';
  }

  return {
    ...preserved,
    metalType: trimText(source.metalType),
    metalPurity: trimText(source.metalPurity),
    actualWeight: actualWeight ? formatNumberString(actualWeight, 3) : '',
    wastagePercent: wastagePercent ? formatNumberString(wastagePercent, 2) : '',
    wastageWeight,
    totalWeight,
    diamondType: trimText(source.diamondType),
    diamondWeight: trimText(source.diamondWeight) ? formatNumberString(source.diamondWeight, 3) : '',
    diamondCarat: trimText(source.diamondCarat) ? formatNumberString(source.diamondCarat, 2) : '',
    diamondPurity: trimText(source.diamondPurity),
    diamondCharge: trimText(source.diamondCharge) ? formatNumberString(source.diamondCharge, 2) : '',
    additionalTax: trimText(source.additionalTax) ? formatNumberString(source.additionalTax, 2) : '',
  };
}

export function getJewelleryBreakdown(attributes = {}) {
  const normalized = normalizeJewelleryAttributes(attributes);

  return {
    ...normalized,
    actualWeightNumber: toJewelleryNumber(normalized.actualWeight, 0),
    wastagePercentNumber: toJewelleryNumber(normalized.wastagePercent, 0),
    wastageWeightNumber: toJewelleryNumber(normalized.wastageWeight, 0),
    totalWeightNumber: toJewelleryNumber(normalized.totalWeight, 0),
    diamondWeightNumber: toJewelleryNumber(normalized.diamondWeight, 0),
    diamondCaratNumber: toJewelleryNumber(normalized.diamondCarat, 0),
    diamondChargeNumber: toJewelleryNumber(normalized.diamondCharge, 0),
    additionalTaxNumber: toJewelleryNumber(normalized.additionalTax, 0),
  };
}
