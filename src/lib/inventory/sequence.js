function extractLastNumber(value) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str) return null;
  const match = str.match(/(\d+)(?!.*\d)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

export function nextSequence(values = [], startAt = 1) {
  const max = values.reduce((acc, v) => {
    const n = extractLastNumber(v);
    if (n === null) return acc;
    return n > acc ? n : acc;
  }, 0);

  const next = max + 1;
  return next >= startAt ? next : startAt;
}

