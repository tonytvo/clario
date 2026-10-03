/**
 * Deterministic equal-split allocation (layer: domain).
 *
 * Splits a total into N shares that sum EXACTLY to the total. Works in integer cents;
 * the odd remainder cents are handed out one-per-participant starting at the first id
 * (the payer, by construction of the participant list). e.g. $10 / 3 → 3.34, 3.33, 3.33.
 */

export function allocateEqual(amount: number, participantIds: string[]): Record<string, number> {
  const n = participantIds.length;
  const totalCents = Math.round(amount * 100);
  const base = Math.floor(totalCents / n);
  let remainder = totalCents - base * n;

  const result: Record<string, number> = {};
  for (const id of participantIds) {
    const cents = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    result[id] = cents / 100;
  }
  return result;
}
