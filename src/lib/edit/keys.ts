/**
 * Content keys and the token whitelist for in-context editing.
 *
 * Every editable string on the storefront is addressed by a stable dotted
 * key that matches the admin's content keys exactly (read-only check of the
 * admin repo confirmed the shape: `home.hero.eyebrow`, and for list rows
 * `listKey:itemId:fieldKey` such as `home.faq.items:faq-1:question`).
 *
 * This module is imported by the server rendering path only. It is pure
 * data + pure functions, so it costs the normal visitor nothing at runtime.
 */

/**
 * The fixed token whitelist. The CMS will supply strings containing these
 * tokens; the storefront interpolates them and leaves any other `{...}`
 * literal. This must match the admin's ALLOWED_TOKENS (read-only check of
 * the admin repo: `['shown', 'total']`).
 */
export const TOKEN_WHITELIST = ['shown', 'total'] as const;

export type TokenName = (typeof TOKEN_WHITELIST)[number];

/** Values a token can interpolate to. Both are numbers/counters today. */
export type TokenValues = Partial<Record<TokenName, string | number>>;

/** Escape a string for use inside a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Interpolate the whitelisted tokens in a computed string.
 *
 * Only `{shown}` and `{total}` are replaced. Any other `{...}` — including
 * near-misses like `{Shown}` or `{count}` — is returned verbatim, so a CMS
 * string with an unknown token degrades to showing that token rather than
 * silently dropping content.
 *
 * This is deliberately a pure function so it can be unit-tested and reused
 * by both the server render and the edit-mode preview.
 */
export function interpolateTokens(
  text: string,
  values: TokenValues,
): string {
  if (!text.includes('{')) return text;

  let out = text;
  for (const name of TOKEN_WHITELIST) {
    const value = values[name];
    if (value === undefined) continue;
    out = out.replace(
      new RegExp(`\\{${escapeRegExp(name)}\\}`, 'g'),
      String(value),
    );
  }
  return out;
}
