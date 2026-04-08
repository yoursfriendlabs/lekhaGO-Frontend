function toLookupId(value) {
  if (value === null || value === undefined || value === '') return '';
  return String(value);
}

function pickFirstDefined(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '') {
      return value;
    }
  }

  return '';
}

function toLookupAmount(value) {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export function mergeLookupEntities(previous = {}, entities = []) {
  const next = { ...previous };

  entities.forEach((entity) => {
    const id = toLookupId(entity?.id);
    if (!id) return;
    next[id] = { ...(next[id] || {}), ...entity, id };
  });

  return next;
}

export function normalizeLookupProduct(raw = {}) {
  const product = raw?.Product && typeof raw.Product === 'object' ? raw.Product : raw;
  const id = toLookupId(raw.productId || product.id);
  const name = String(
    pickFirstDefined(raw.productName, product.name, raw.description, id ? `Product ${id}` : '')
  ).trim();
  const primaryUnit = String(
    pickFirstDefined(
      raw.primaryUnit,
      product.primaryUnit,
      raw.unitType === 'primary' ? raw.actualUnit : '',
      raw.actualUnit
    )
  ).trim();
  const secondaryUnit = String(
    pickFirstDefined(
      raw.secondaryUnit,
      product.secondaryUnit,
      raw.unitType === 'secondary' ? raw.actualUnit : ''
    )
  ).trim();

  return {
    id,
    name,
    companyName: String(pickFirstDefined(raw.companyName, product.companyName)).trim(),
    metalType: String(pickFirstDefined(raw.metalType, product.metalType)).trim(),
    purity: String(pickFirstDefined(raw.purity, product.purity)).trim(),
    primaryUnit,
    secondaryUnit,
    salePrice: Number(pickFirstDefined(raw.salePrice, product.salePrice, 0)),
    purchasePrice: Number(pickFirstDefined(raw.purchasePrice, product.purchasePrice, 0)),
    secondarySalePrice: Number(pickFirstDefined(raw.secondarySalePrice, product.secondarySalePrice, 0)),
    conversionRate: Number(pickFirstDefined(raw.conversionRate, product.conversionRate, 0)),
    itemType: String(pickFirstDefined(raw.itemType, product.itemType, 'goods')).trim(),
    stockOnHand: Number(pickFirstDefined(raw.stockOnHand, product.stockOnHand, 0)),
  };
}

export function normalizeLookupParty(raw = {}) {
  const party = raw?.Party && typeof raw.Party === 'object' ? raw.Party : raw;
  const id = toLookupId(raw.partyId || party.id);

  return {
    id,
    name: String(
      pickFirstDefined(raw.partyName, raw.customerName, raw.supplierName, party.name, id ? `Party ${id}` : '')
    ).trim(),
    phone: String(pickFirstDefined(raw.phone, raw.partyPhone, party.phone)).trim(),
    type: String(pickFirstDefined(raw.type, party.type, 'both')).trim(),
    currentAmount: toLookupAmount(
      pickFirstDefined(raw.currentAmount, raw.balance, party.currentAmount, party.balance)
    ),
  };
}

export function formatProductLookupLabel(product = {}) {
  const jewelleryMeta = [product.metalType, product.purity].filter(Boolean).join(' ');

  return [
    product.name || '—',
    jewelleryMeta,
    product.companyName || '',
    product.primaryUnit || '',
  ]
    .filter(Boolean)
    .join(' · ');
}

export function formatPartyLookupLabel(party = {}) {
  const name = party.name || '—';
  return party.phone ? `${name} (${party.phone})` : name;
}

export function toProductLookupOption(raw) {
  const product = normalizeLookupProduct(raw);

  return {
    value: product.id,
    label: formatProductLookupLabel(product),
    entity: product,
  };
}

export function toPartyLookupOption(raw) {
  const party = normalizeLookupParty(raw);

  return {
    value: party.id,
    label: formatPartyLookupLabel(party),
    entity: party,
  };
}
