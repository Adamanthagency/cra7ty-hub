import fs from 'fs';
const raw = fs.readFileSync('src/data/site.ts','utf8').split('\n');
let s = 0;
for (let i = 0; i < raw.length; i++) {
  if (raw[i].trim().startsWith('export const site =')) { s = i + 1; break; }
}
const body = raw.slice(s).join('\n').trim().replace(/ as const;$/, '').trim();
function scan(str, quote) {
  const out = new Set();
  let key = '', cur = '', inStr = false, q = null;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i], next = str[i + 1] || '';
    if (inStr) {
      if (q === '\' && next) { cur += q + next; i++; continue; }
      if (ch === q && next !== '\') { inStr = false; if (key) out.add(cur.trim()); cur = ''; }
      else cur += ch;
      continue;
    }
    if (ch === quote) { inStr = true; q = ch; cur = ''; continue; }
    if (ch === '\' && next) { cur += ch + next; i++; continue; }
    if (ch === ':' && !key) { const k = cur.trim(); if (k) key = k; cur = ''; continue; }
    if (ch === '{' || ch === '[') { cur = ''; key = ''; continue; }
    if (ch === '}' || ch === ']') { cur = ''; key = ''; continue; }
    if (ch === ',') { cur = ''; key = ''; continue; }
    cur += ch;
  }
  return out;
}
const singles = scan(body, "'");
const doubles = scan(body, '"');
const strings = new Set([...singles, ...doubles]);
console.log(strings.size, 'strings in site.ts object');
console.log(Array.from(strings).slice(0, 12).join('\n'));
