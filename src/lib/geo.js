/**
 * @typedef {Object} Coordinates
 * @property {number} lat
 * @property {number} lng
 */

/**
 * Extract lat/lng coordinates from a record using various possible field name patterns.
 * @param {Object} record
 * @param {string} prefix - e.g. "punchIn", "punchOut", or ""
 * @returns {Coordinates|null}
 */
export function extractCoordinates(record, prefix) {
  if (!record) return null;

  const patterns = [
    [`${prefix}Latitude`, `${prefix}Longitude`],
    [`${prefix}Lat`, `${prefix}Lng`],
    [`${prefix}_latitude`, `${prefix}_longitude`],
    [`${prefix}_lat`, `${prefix}_long`],
  ];

  for (const [latKey, lngKey] of patterns) {
    const lat = record[latKey];
    const lng = record[lngKey];
    if (lat != null && lng != null) {
      return { lat: Number(lat), lng: Number(lng) };
    }
  }

  return null;
}

/**
 * Build a Google Maps URL from lat/lng coordinates.
 * @param {number} lat
 * @param {number} lng
 * @returns {string}
 */
export function googleMapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
