#!/usr/bin/env node
/**
 * seed-catalog.mjs — one-time (idempotent, safe to re-run) seed of the
 * catalog tables from the storefront's own static data files.
 *
 * Writes: products, categories, blog_posts — full storefront shapes
 * (model, counts, detail/specs arrays, titleLines/body paragraphs).
 * Upserts by primary key only — never deletes a row it does not own.
 * Deliberately skips the workbench tables: the admin seed
 * (scripts/seed-workbench.mjs in cra7ty-hub-admin) owns those.
 *
 * Credentials: SUPABASE_URL (falls back to NEXT_PUBLIC_SUPABASE_URL —
 * it is public) + SUPABASE_SERVICE_ROLE_KEY from ../.env.local.
 * Server-side script only. The service-role key is never logged,
 * never printed, and is sent only to this project's own PostgREST endpoint.
 *
 * Run:  node scripts/seed-catalog.mjs
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Node's built-in env loading — no dotenv dependency.
try {
  process.loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env.local'));
} catch {
  // missing file surfaces as the var check below
}

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    'Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (expected in .env.local). Nothing written.'
  );
  process.exit(1);
}

// The data files are TypeScript with type-only imports; Node's native type
// stripping erases those at load time, so the @/ alias never resolves.
const { products, categories } = await import('../src/data/products.ts');
const { posts } = await import('../src/data/posts.ts');

async function upsert(table, rows) {
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${table}: HTTP ${res.status} — ${body.slice(0, 300)}`);
  }
  const back = await res.json();
  console.log(`${table}: ${back.length} rows`);
}

/* products — position = array order in /data/products.ts (the featured
 * order the storefront renders). */
await upsert(
  'products',
  products.map((p, i) => ({
    id: p.id,
    position: i,
    slug: p.slug,
    name: p.name,
    category: p.category,
    price: p.price,
    description: p.description,
    badge: p.badge ?? null,
    model: p.model,
    pack_count: p.packCount ?? null,
    size: p.size ?? null,
    detail: p.detail,
    specs: p.specs,
  }))
);

/* categories — position = array order; `index` (reserved-ish in SQL) is
 * stored as index_label. */
await upsert(
  'categories',
  categories.map((c, i) => ({
    id: c.id,
    position: i,
    index_label: c.index,
    name: c.name,
    blurb: c.blurb,
    model: c.model,
    count: c.count,
  }))
);

/* blog_posts — id = slug; position = array order in /data/posts.ts. */
await upsert(
  'blog_posts',
  posts.map((p, i) => ({
    id: p.slug,
    position: i,
    slug: p.slug,
    title: p.title,
    title_lines: [...p.titleLines],
    standfirst: p.standfirst,
    excerpt: p.excerpt,
    date: p.date,
    minutes: p.minutes,
    category: p.category,
    model: p.model,
    body: p.body,
    related_product_ids: p.relatedProductIds,
    placeholder: p.placeholder,
  }))
);

console.log('seed-catalog: done');
