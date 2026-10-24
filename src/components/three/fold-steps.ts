/**
 * The twelve real crane folds, in the order a pair of hands makes them.
 * Kept in its own module so the caption can be imported without pulling the
 * three.js scene — and therefore three.js itself — into the page bundle.
 */
export const foldStepNames = [
  'Fold in half',
  'Fold in half again',
  'Crease both diagonals',
  'Open to a square',
  'Collapse the base',
  'Petal fold',
  'Petal fold',
  'Repeat behind',
  'Reverse fold',
  'Neck up',
  'Tail up',
  'Set the wings',
] as const;