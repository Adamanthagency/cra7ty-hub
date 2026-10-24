/** Naira formatting: 4500 -> ₦4,500. Used everywhere a price is printed. */
export function naira(amount: number): string {
  return `₦${Math.round(amount).toLocaleString('en-NG')}`;
}

/** Compact form for tight mono labels, e.g. ₦4.5k */
export function nairaCompact(amount: number): string {
  if (amount >= 1000) {
    const k = amount / 1000;
    const text = Number.isInteger(k) ? String(k) : k.toFixed(1).replace(/\.0$/, '');
    return `₦${text}k`;
  }
  return naira(amount);
}

/** Two-digit editorial numbering, e.g. 7 -> "07" */
export function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}