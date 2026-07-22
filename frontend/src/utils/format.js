/* ============================================================
   CarInsight Pro — Shared utilities
   File: src/utils/format.js
   ============================================================ */

/**
 * Format a raw rupee number into the Indian numbering system.
 * 524311  → "₹5,24,311"
 *
 * @param {number} n - raw rupee value
 * @returns {string}
 */
export const fmtINR = (n) => {
  if (n == null || isNaN(n)) return '₹0';
  return '₹' + Math.round(n).toLocaleString('en-IN');
};

/**
 * Format into Lakh / Crore for headline display.
 * 524311   → "₹5.24 L"
 * 12500000 → "₹1.25 Cr"
 * 80000    → "₹80,000"
 *
 * @param {number} n
 * @returns {{rupee:'₹', value:string, unit:string}}
 *          So you can style each part independently.
 */
export const fmtLakhParts = (n) => {
  if (n == null || isNaN(n)) return { rupee: '₹', value: '0', unit: '' };
  const abs = Math.abs(n);
  if (abs >= 10000000) return { rupee: '₹', value: (n / 10000000).toFixed(2), unit: 'Cr' };
  if (abs >= 100000)   return { rupee: '₹', value: (n / 100000).toFixed(2),  unit: 'Lakh' };
  if (abs >= 1000)     return { rupee: '₹', value: (n / 1000).toFixed(1),    unit: 'K' };
  return { rupee: '₹', value: Math.round(n).toString(), unit: '' };
};

/** Compact label variant: returns "₹5.24L" as a single string */
export const fmtL = (n) => {
  const p = fmtLakhParts(n);
  return `${p.rupee}${p.value}${p.unit ? ' ' + p.unit : ''}`;
};

/** KM formatter — 42500 → "42,500 km" */
export const fmtKM = (n) => {
  if (n == null || isNaN(n)) return '0 km';
  return Math.round(n).toLocaleString('en-IN') + ' km';
};
