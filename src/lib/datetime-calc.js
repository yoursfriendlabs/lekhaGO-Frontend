import dayjs from "./datetime";

/**
 * @typedef {Object} DurationInfo
 * @property {number} hours
 * @property {number} minutes
 * @property {string} formatted - e.g. "8h 30m"
 * @property {number} decimal - e.g. 8.5
 */

/**
 * Calculate total hours between two ISO datetime strings.
 * @param {string|null} punchIn
 * @param {string|null} punchOut
 * @returns {DurationInfo|null}
 */
export function calculateDuration(punchIn, punchOut) {
  if (!punchIn || !punchOut) return null;

  const start = dayjs(punchIn);
  const end = dayjs(punchOut);

  if (!start.isValid() || !end.isValid()) return null;

  const diffMinutes = end.diff(start, "minute");
  if (diffMinutes < 0) return null;

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  return {
    hours,
    minutes,
    formatted: `${hours}h ${minutes}m`,
    decimal: diffMinutes / 60,
  };
}

/**
 * Calculate total hours as a decimal number (e.g., 8.5 for 8h 30m).
 * @param {string|null} punchIn
 * @param {string|null} punchOut
 * @returns {number}
 */
export function calculateDurationDecimal(punchIn, punchOut) {
  return calculateDuration(punchIn, punchOut)?.decimal ?? 0;
}
