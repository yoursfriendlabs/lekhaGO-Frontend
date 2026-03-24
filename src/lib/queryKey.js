function sortObjectEntries(entries) {
  return [...entries].sort(([left], [right]) => left.localeCompare(right));
}

function normalizeValue(value) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined && item !== null && item !== '')
      .map((item) => normalizeValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      sortObjectEntries(Object.entries(value))
        .filter(([, nestedValue]) => nestedValue !== undefined && nestedValue !== null && nestedValue !== '')
        .map(([key, nestedValue]) => [key, normalizeValue(nestedValue)])
    );
  }

  return value;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${sortObjectEntries(Object.entries(value))
      .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableStringify(nestedValue)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

export function normalizeQueryParams(params = {}) {
  return normalizeValue(params);
}

export function toQueryString(params = {}) {
  const normalized = normalizeQueryParams(params);
  const searchParams = new URLSearchParams();

  Object.entries(normalized).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, String(item)));
      return;
    }

    searchParams.append(key, String(value));
  });

  return searchParams.toString();
}

export function toQueryKey(params = {}) {
  return stableStringify(normalizeQueryParams(params));
}

export function toScopedQueryKey(scope, params = {}) {
  return `${scope || 'default'}:${toQueryKey(params)}`;
}
