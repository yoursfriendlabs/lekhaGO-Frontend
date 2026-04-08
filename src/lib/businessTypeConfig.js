const RETAIL_BUSINESS_TYPE = 'retail';
const RETAIL_SERVICES_LABEL = 'Sales & Services';

export function isRetailBusinessType(businessProfile) {
  return businessProfile?.type === RETAIL_BUSINESS_TYPE;
}

export function getServicesDisplayLabel(businessProfile, fallbackLabel = 'Services') {
  return isRetailBusinessType(businessProfile) ? RETAIL_SERVICES_LABEL : fallbackLabel;
}

export function getNavigationForBusinessType(navigation = [], businessProfile) {
  if (!Array.isArray(navigation) || !isRetailBusinessType(businessProfile)) {
    return navigation;
  }

  return navigation
    .filter((item) => item?.key !== 'sales')
    .map((item) => (item?.key === 'services'
      ? { ...item, label: getServicesDisplayLabel(businessProfile, item.label) }
      : item));
}
