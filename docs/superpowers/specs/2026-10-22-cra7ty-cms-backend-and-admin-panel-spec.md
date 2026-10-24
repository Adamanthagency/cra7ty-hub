# CRA7TY HUB — CMS BACKEND + ADMIN PANEL (THE WORKBENCH)
> **Architectural spec for the Supabase-backed CMS that turns the public site into a real studio site and gives the client a WordPress-like panel to manage everything.**

This spec is the source of truth for the plan. It records what was read, what was decided, and what is out of scope, so the plan and the implementation can argue from it.

---

## 1. Intent and success criteria

**What we are building:** A Supabase-backed CMS layer behind the existing CRA7TY HUB public site, plus a separate admin panel project (the "Workbench") where the client can edit everything without touching code.

**Who it is for:** The studio owner (the client) managing the site from a laptop or phone, with the same locked design still rendering on the public site.

**Success looks like:**
- The public site renders pixel-identical to today when Supabase has no env vars or no seeded data, using the existing `/data` files as fallback.
- Every piece of text the client expects to edit is editable from the Workbench, mapped 1:1 from the string inventory.
- Products and posts can be created, edited, hidden, deleted, and reordered from the Workbench, with the public site reflecting published content only.
- Category counts are computed at read time, never stored.
- The Workbench shares the same palette, fonts, and Tailwind tokens as the public site, copied in (not imported across projects).
- Payments and Paystack stay completely out of this work.

---

## 2. Two projects, one Supabase project

- **Public site:** the existing Next.js 14 + TypeScript + Tailwind project in `C:\Users\ROG ZEPHYRUS\Projects\cra7ty-hub`. Pages: `/`, `/shop`, `/blog`, `/blog/[slug]`, `/about`, `/products/[slug]`. Content currently lives in code (`src/data/site.ts`, `products.ts`, `posts.ts`) plus a few hardcoded strings in components.
- **Admin panel:** a new, separate Next.js 14 + TypeScript + Tailwind project to be created at `C:\Users\ROG ZEPHYRUS\Projects\cra7ty-hub-admin` (path contains a space — quote it in every command). It writes content to Supabase. No admin UI or admin code goes inside the public site, except the small preview bridge in Stage 7.

Both projects read/write the same Supabase project (`somoluwabi60@gmail.com's Project`, ref `jaqvclaowdqakoupjwjo`, Central EU / Frankfurt).

---

## 3. Supabase project — state read so far

- CLI: `supabase` 2.108.0 installed; linked to the project with `supabase link --project-ref jaqvclaowdqakoupjwjo`. Linked-project metadata stored under `supabase/.temp/`.
- Auth: `supabase status` and `db dump` both fail because Docker Desktop is not running (`//./pipe/dockerDesktopLinuxEngine` not found). So we cannot run local dev, pull schema, or dump the remote schema from the CLI right now. We can still `supabase db pull --linked` / `db diff --linked` once Docker is available, and we can run SQL through the API or the Supabase dashboard.
- No local env vars are set (`SUPABASE_URL`/`SUPABASE_ANON_KEY` unset), so the existing catalog fallback path is the one the site actually runs on today.
- The public site already has a CMS seam started: `src/lib/catalog.ts` reads from Supabase REST with explicit column lists and falls back to `/data`. It is not yet the deployed reality — today the pages import from `/data` directly. This spec treats `catalog.ts` as the intended seam and completes it.
- No `.env` files exist on disk and none are tracked (no git repo here: `fatal: not a git repository`). `.gitignore` does not exist at repo root; `.freebuff/.gitignore` only excludes `/project-id` and `/.gitignore`. The PostHog env vars are public (`NEXT_PUBLIC_*`), and the only secret-ish values in the repo are the WhatsApp placeholder and the PostHog example tokens — neither is a real secret. That is verified by the grep we ran: the only `SUPABASE_*` references are the two reads in `catalog.ts` and the replay-token references, which are public.

**Supabase object inventory is not yet retrieved** because Docker is down and we have not run dashboard SQL. The plan's Stage 0 will retrieve it through the dashboard SQL editor (or API) before any write SQL. Until then, the following working assumption stands, and the plan explicitly verifies it: the project is "mostly empty" with some reverted migrations (the `db pull` error listed reverted migration timestamps from 2026-10-16 and 2026-10-17), so we expect little or nothing usable, and we will classify every real object before touching it.

**The `sbfenv` edge function:** the prompt said a previous session found an edge function named `sbfenv` that dumps environment variables without authentication. We have not confirmed whether it still exists, because that requires either a dashboard inspection or a Docker-based CLI call. The plan treats this as a flagged security item and checks it in Stage 0 before anything else.

---

## 4. Design tokens — locked, copied in

The public site's design is locked and must stay pixel-identical. The tokens are:

**Palette:**
- paper `#f4efe6`
- kraft `#d9c7a7`
- ink `#16130f`
- vermilion `#e5391f`
- moss `#3e5641`
- plus the existing alpha ramps already defined in the public site.

**Fonts:**
- Instrument Serif (display)
- Schibsted Grotesk
- JetBrains Mono (mono labels, prices, editorial numbers)

**Type scale, primitives, motion rules:** exactly as they already are on the public site. The public site must not change visually when wired to Supabase. The admin copies these tokens in (same palette, same fonts, same Tailwind theme shape) so the Workbench feels like the same studio — copied, not imported across projects.

---

## 5. What the client must be able to do (requirements → data model)

The client wants WordPress-like control, from a phone too. Concretely:

1. **Products:** upload, edit, hide, delete, with photos. Each product has a stable text id (because saved orders in visitors' browsers reference product ids), a unique slug, and a status of `published` or `draft`. Photos live in Supabase Storage; the product row references them.
2. **Blog posts:** write, edit, publish, delete.
3. **Every piece of text on every page:** headlines, ledes, buttons, marquee words, FAQ, testimonials, nav labels, footer, contact details, page titles and descriptions. This is the big one — it comes from the string inventory.
4. **Position and visibility:** reorder sections on each page, show/hide sections, and pick layout variants where they exist. Not free pixel positioning — the design is locked, and the admin must not be able to break it.
5. **Settings:** WhatsApp number, email, address, Instagram, free-delivery threshold, nav and footer links.
6. **Preview → publish → history → rollback.**

**Out of scope for this entire effort:** payments. A Paystack secret key is stored somewhere in the Supabase account. Do not read it, print it, log it, copy it, move it, rotate it, or delete it. Do not put it in any `.env`. Do not write any payment code, routes, tables, columns, or Paystack SDK usage. Do not touch wherever it is stored (Vault, a secrets table, edge-function secrets, or anywhere else). If we find it, report only WHERE, never the value, and exclude that location from every cleanup.

---

## 6. String inventory — what must become editable

The string inventory is the bridge between "what the site says today" and "what the client can edit." It is built from two sources: the data files (already structured as editable objects) and the inline strings inside components (must be lifted into editable fields).

### 6.1 Already-structured, ready to map

These already live in `src/data/site.ts` as named objects, so they map cleanly to CMS fields:

- `site` — name, tagline, description, url, locale, whatsappNumber, whatsappDisplay, email, instagram, instagramUrl, city, studio, foundedYear, freeDeliveryOver
- `navLinks` — array of `{ label, href }`
- `marqueeWords` — array of strings
- `hero` — eyebrow, headline (array), emphasisWord, subline, primaryCta, secondaryCta, stats (array of `{ value, label }`)
- `sections` — per-section index/title/lede for categories, shop, process, bulk, why, testimonials, faq
- `shopPage` — index, title, lede, metaDescription, railLabel, allTab, sortLabel, searchLabel, searchPlaceholder, searchButton, searchClear, searchStatus (fn), noResults, noResultsCta, sortOptions, emptyBulk, emptyBulkCta
- `blogPage` — index, title, lede, metaDescription, readLink, moreLabel, relatedLabel, allNotesLabel, closing
- `aboutPage` — hero, sheet (index/title/lede/stations array), numbersIndex, numbersTitle, facts (index/title/lede/card), closing, metaDescription
- `processSteps` — array of `{ index, title, body }`
- `whyPoints` — array of `{ index, title, body }`
- `testimonials` — array of `{ quote, name, city, placeholder }`
- `footer` — smallPrint, columns (array of `{ heading, links }`)

### 6.2 Already-structured in product/post data

- `products` — each product: id, slug, name, category, price, description, badge, model, packCount, size, detail (array), specs (array of `{ label, value }`), plus featured and is_active flags the CMS will own.
- `posts` — each post: slug, title, titleLines, standfirst, excerpt, date, minutes, category, model, body (array), relatedProductIds, placeholder.

### 6.3 Inline strings in components that must be lifted

These are the strings baked into JSX or inline arrays that are not read from a data file. They must become editable fields (most as content_block fields on the relevant page/section, a few as small fixed fields). The ones found:

- **OrderDrawer.tsx:**
  - `"Add to order"` — AddToOrderButton label (already a prop defaulting to `"Add to order"`; make it editable or keep as a fixed primitive label — decision: keep the component default but expose per-product override later if needed; for v1, the fixed label is acceptable and intentional, because it is a UI primitive label, not editorial copy. However, the drawer itself has editable copy: "Your order", "Empty", "Order total", "Message the studio" phone link, "Hello Cra7ty Hub, I would like to ask about a custom order.", and the empty-state headline + subline. The empty-state copy is currently inline — lift it.)
  - Empty-drawer headline and subline (inline JSX strings) — lift to a content block on a small "order drawer" section or to site settings.
  - The pre-filled custom-order message `"Hello Cra7ty Hub, I would like to ask about a custom order."` — this is already mirrored in `whatsapp.ts` (`buildOrderMessage` header) and in `src/app/about/page.tsx` (`studioQuestion`). It is editorial copy that should be editable — lift to a site setting or a content block.

- **SiteNav.tsx:**
  - Nav label "Order" on the sticky order button — this is a UI label; for v1 it is acceptable as a fixed primitive label, but the client may want it editable. Decision: expose as a small editable field on a "nav" content block or site setting for completeness, because the client explicitly wants nav labels editable.

- **SiteFooter.tsx:**
  - Footer heading "Reach us" and the contact link labels "WhatsApp", "Instagram", "Email" — these are labels on contact links. The footer columns are already fully editable from `footer.columns`, but the "Reach us" block is separate inline contact links. Lift to editable fields.

- **Hero.tsx:**
  - The marquee is driven by `marqueeWords` — already editable.
  - Hero copy is already fully in `hero` — already editable.

- **FeaturedProducts.tsx:**
  - The "six of eleven" pointer: the section computes the featured count and total from the products. There is no hardcoded editorial string there that needs editing — it is derived. So no content block needed for that pointer; the "six" is a computed value, not copy. (Verify: the pointer text is derived from counts, not a fixed string.)

- **ShopShelf.tsx:**
  - The sort options labels ("Featured", "Price, low to high", "Price, high to low") — these are already in `shopPage.sortOptions` and are editable.
  - Search placeholder and button/clear labels — already in `shopPage`.
  - So ShopShelf has no remaining inline editorial strings once `shopPage` is wired.

- **BulkBand.tsx:**
  - `"Hello Cra7ty Hub, I am planning an event and need a bulk quote. Here is what I have:"` — pre-filled WhatsApp message for bulk. This is editorial copy — lift to a site setting or content block. (Mirror of the same pattern as the custom-order message.)
  - The bulk use-case list items ("Weddings", "Naming ceremonies", "School events", "Small businesses") with notes — these are editorial; lift to editable rows. Currently inline in the component.

- **WhyPaper.tsx, Process.tsx, Testimonials.tsx, Faq.tsx, AboutHero.tsx, Categories.tsx, ShopShelf.tsx:**
  - These render from data files (`whyPoints`, `processSteps`, `testimonials`, `faq` items, categories, products). No new inline editorial strings to lift beyond what is already structured — except confirm Faq.tsx renders FAQ items from an inline array or from data. We read Faq.tsx earlier; it renders FAQ items. Check whether the FAQ items are inline in the component or in a data file. If inline, lift to a content table.

- **primitives:**
  - Button default label "Add to order" (AddToOrderButton) — discussed above.
  - MonoLabel, Marquee, Section, Container, FoldDivider, DogEarCard, Reveal, Icons — these are primitives; their strings are either props or purely presentational (SVG paths, CSS). No editorial strings to lift.

- **App pages:**
  - `blog/[slug]/page.tsx` and `products/[slug]/page.tsx` render breadcrumbs with "Home" and the section name; those are fixed UI labels ("Home") — acceptable as fixed primitives. The breadcrumb section label is derived from data (`product.category`, `blogPage.title`).
  - `about/page.tsx` renders `studioQuestion` which is already lifted (it is a const in the page, derived from editorial copy — move it to be editable).
  - The about numbers strip computes values from data; no hardcoded editorial strings.

**Summary of new editable fields to add beyond the data files:**
1. Order drawer empty-state copy (headline + subline) — content block or site setting.
2. Custom-order WhatsApp message (`"Hello Cra7ty Hub, I would like to ask about a custom order."`) — site setting (replaces both the one in `whatsapp.ts` and the one in `about/page.tsx`).
3. Bulk quote WhatsApp message (`"Hello Cra7ty Hub, I am planning an event and need a bulk quote. Here is what I have:"`) — site setting.
4. Nav "Order" button label — small editable field.
5. Footer "Reach us" heading + contact link labels (WhatsApp / Instagram / Email) — editable fields.
6. Bulk use-case list (Weddings / Naming ceremonies / School events / Small businesses + notes) — editable rows.
7. FAQ items — if currently inline, lift to a FAQ table; if already in data, map to content.

We will confirm the FAQ source in Stage 0 and finalize the inventory there.

---

## 7. Data model — tables, RLS, roles, helpers

All identifiers lowercase snake_case. Primary keys: `id` uuid for most; **products.id is a stable text id** (because saved orders in browsers reference it). Every table gets `created_at` and `updated_at`. Every getter selects explicit columns, never `*`. RLS on every table. Roles enforced in RLS **and** again in every server action.

### 7.1 Roles

- `admin_profiles`: one row per Supabase auth user who can log into the Workbench. Columns: `id` (uuid, PK, references auth.users), `email`, `role` (`'owner'` | `'editor'`), `full_name`, `avatar_url`, `created_at`.
  - owner: everything, including settings, page_meta, and people (admin_profiles).
  - editor: products, categories, posts, media, sections, content — but NOT settings, page_meta, or people.
- No public signup path. Workbench auth via Supabase Auth with email/password (or the existing auth approach), and we create the owner/editor accounts explicitly. RLS blocks anon entirely from these tables.

### 7.2 Tables

**admin_profiles** — described above.

**categories:**
- `id` text PK (the `category_id` value, e.g. `origami`, `table`, `party`, `gift`, `bulk`, `paper` — matches the app's `CategoryId` type)
- `index` text (two-digit editorial number, e.g. `01`)
- `name` text
- `blurb` text
- `model` text (ModelKey value)
- `position` int
- `created_at`, `updated_at`
- RLS: anon SELECT all (public); owner/editor INSERT/UPDATE/DELETE. Count computed at read time from published products.

**products:**
- `id` text PK (stable, matches existing product ids like `crane-string-20`)
- `slug` text unique
- `name` text
- `category_id` text FK → categories.id
- `price` int (naira, whole units)
- `description` text
- `badge` text nullable
- `model` text
- `pack_count` text nullable
- `size` text nullable
- `detail` text[] 
- `specs` jsonb (array of `{ label, value }`)
- `featured` boolean
- `is_active` boolean (published/draft for products — use `is_active` = visible on the public site; keep a separate `status`? The prompt says "status published or draft". For products, `is_active` already exists in the seam. Decision: products use `is_active` boolean where true = published, false = draft/hidden. Posts use an explicit `status` text enum `published | draft` because posts have a clearer publish concept and the existing seam calls it `placeholder` which is different. We reconcile in the plan.)
- `position` int
- `created_at`, `updated_at`
- RLS: anon SELECT where is_active = true; owner/editor full CRUD. `id` is stable text.

**product_images:**
- `id` uuid PK
- `product_id` text FK → products.id
- `storage_path` text (the Storage object path)
- `alt` text nullable
- `position` int
- `created_at`
- RLS: anon SELECT where product is active (via join or a helper); owner/editor CRUD.

**posts (blog_posts):**
- `id` uuid PK (or text? Posts do not need stable ids for orders; uuid is fine)
- `slug` text unique
- `title` text
- `title_lines` text[]
- `standfirst` text
- `excerpt` text
- `post_date` date
- `minutes` int
- `category` text
- `model` text
- `body` text[]
- `related_product_ids` text[]
- `placeholder` boolean (keep for the existing placeholder concept, but the CMS will stop using placeholders — published posts are real)
- `status` text enum `published | draft`
- `created_at`, `updated_at`
- RLS: anon SELECT where status = 'published'; owner/editor full CRUD.

**site_settings:**
- `id` uuid PK, or a single-row table with a fixed id. Decision: a single-row settings table with a fixed id (`'default'`) and RLS that only owner can touch. Columns:
  - `whatsapp_number` text
  - `whatsapp_display` text
  - `email` text
  - `instagram` text
  - `instagram_url` text
  - `city` text
  - `studio` text
  - `founded_year` int
  - `free_delivery_over` int
  - `url` text
  - `locale` text
  - `custom_order_message` text (the "Hello Cra7ty Hub, I would like to ask about a custom order." copy)
  - `bulk_quote_message` text (the bulk message copy)
  - `nav_order_label` text ("Order")
  - `footer_reach_heading` text ("Reach us")
  - `footer_whatsapp_label` text
  - `footer_instagram_label` text
  - `footer_email_label` text
  - `created_at`, `updated_at`
- RLS: anon SELECT (public reads the settings the site needs); owner only INSERT/UPDATE/DELETE. Editors cannot touch settings.

**page_meta:**
- `id` uuid PK
- `page` text (e.g. `home`, `shop`, `blog`, `blog_post`, `about`, `product`)
- `title` text (page title)
- `description` text (meta description)
- `canonical` text nullable
- `created_at`, `updated_at`
- One row per page type. RLS: anon SELECT; owner only INSERT/UPDATE/DELETE. Editors cannot touch page_meta.

**page_sections:**
- `id` uuid PK
- `page` text (page identifier)
- `section_key` text (e.g. `hero`, `categories`, `shop`, `process`, `bulk`, `why`, `testimonials`, `faq`, `marquee`, `about_hero`, `about_sheet`, `about_facts`, `about_closing`, `blog_closing`, `shop_rail`, etc.)
- `position` int
- `visible` boolean
- `variant` text nullable (layout variant where they exist)
- `created_at`, `updated_at`
- RLS: anon SELECT (the public site needs to know which sections to render and in what order); owner/editor INSERT/UPDATE/DELETE.

**content_blocks:**
- `id` uuid PK
- `page` text
- `section_key` text
- `field_key` text (e.g. `hero.headline`, `sections.categories.title`, `shopPage.lede`, `navLinks`, `marqueeWords`, `footer.columns`, `hero.stats`, etc.)
- `value` jsonb — the published value
- `draft_value` jsonb — the in-progress value, unreadable by anon
- `status` text enum `published | draft`
- `created_at`, `updated_at`
- RLS: anon SELECT `value` where status = 'published'; anon must never read `draft_value`. owner/editor full CRUD. The `draft_value` column must be unreadable by anonymous users — via column-level privilege (revoke SELECT on draft_value from anon) or a separate draft table. Decision: column-level privilege — GRANT SELECT on the table to anon but REVOKE SELECT on draft_value from anon, then grant it back only to owner/editor roles via a helper that is itself locked down. But the cleanest Postgres approach: keep `draft_value` in the same table and revoke its SELECT from anon; authenticated editors get it through a role they hold. We will implement and verify in the plan.
- Actually — the simplest robust approach: two tables. `content_blocks` (published, anon-readable where published) and `content_drafts` (draft_value + status, only owner/editor). That avoids any column-privilege footgun and makes the "draft unreadable by anon" rule impossible to violate by accident. Decision: two tables. The plan uses `content_blocks` for published and `content_drafts` for drafts, with a server-action layer that copies published → draft on edit start and draft → published on publish.

Hmm — but the prompt explicitly says "draft_value must be unreadable by anonymous users (column-level privilege or a separate table)". So either is acceptable. The separate-table approach is the safer one and easier to reason about. We'll go with a single table + column privilege only if it proves simpler; the plan's Stage 1 will decide and verify. For the spec, I'll say: separate `content_drafts` table, because it is the most auditable.

**media:**
- `id` uuid PK
- `owner_id` uuid FK → admin_profiles.id (who uploaded it)
- `storage_path` text
- `original_name` text
- `mime_type` text
- `size_bytes` int
- `width` int nullable, `height` int nullable
- `created_at`
- RLS: owner/editor CRUD; anon may need to read some media URLs (product images) — that is via product_images, not directly. So media itself can be owner/editor only, and product_images exposes the public path.

**revisions:**
- `id` uuid PK
- `table_name` text
- `record_id` text
- `record_type` text (which entity: product, post, setting, content_block, etc.)
- `data` jsonb (the full row snapshot at publish, or the content_block published value)
- `author_id` uuid FK → admin_profiles.id
- `created_at`
- This backs "see history and roll back." RLS: owner/editor only.

**audit_log:**
- `id` uuid PK
- `actor_id` uuid FK → admin_profiles.id
- `action` text (e.g. `product.publish`, `content_block.update`, `setting.change`)
- `table_name` text
- `record_id` text
- `before` jsonb nullable
- `after` jsonb nullable
- `ip_address` text nullable
- `created_at`
- RLS: owner only (editors do not read audit_log). This is the "who did what" log.

**login_attempts:**
- `id` uuid PK
- `email` text
- `success` boolean
- `ip_address` text nullable
- `created_at`
- For brute-force visibility. RLS: owner only.

### 7.3 Helper functions and privilege hygiene

Any helper function used in RLS must not be callable from the public API. So: revoke EXECUTE from public/anon/authenticated where appropriate, and only grant it to the roles that need it. Every RLS helper is `SECURITY DEFINER` with `search_path = pg_catalog, public` and owns nothing it should not. We follow the supabase-postgres-best-practices rules: security-definer hygiene, least privilege, explicit grants.

### 7.4 How existing data maps to seed rows

The seed SQL (run once by the owner) will insert:
- admin_profiles: the owner account (created separately via auth + a profile row).
- categories: the six categories from `src/data/products.ts` (`categories` array).
- products: all 11 products from `src/data/products.ts`, with `is_active = true`, `featured` set for the six featured ids, stable ids preserved.
- posts: the posts from `src/data/posts.ts`, status `published`.
- site_settings: one row built from `site` + the lifted messages.
- page_meta: one row per page built from `site`, `shopPage.metaDescription`, `blogPage.metaDescription`, `aboutPage.metaDescription`, and product/post titles.
- page_sections: one row per section per page, in the current order, all visible, with the variants that exist.
- content_blocks: one row per field in every site object, per the string inventory, with the current values as the published `value`.
- media: none initially (no product photos yet — the client uploads those).
- revisions, audit_log, login_attempts: empty.

Category counts are never seeded — they are computed at read time from published products.

---

## 8. Rendering — public site stays fast and static

- The public site stays statically generated. `generateStaticParams` for products and posts keeps working.
- `dynamicParams = true` on those routes so a brand-new product or post resolves immediately without a rebuild.
- Publish in the Workbench triggers on-demand revalidation through a secured endpoint on the public site (a Next.js rewrite/route that accepts a secret or a Supabase-signed request and calls `revalidatePath`). Only the Workbench (or the owner) can call it.
- ISR revalidation uses the 300s window already in `catalog.ts`. When Supabase is configured and a fetch fails during ISR, **throw** so Next keeps serving the last good page rather than replacing the client's edits with defaults. During a production build, **fail the build loudly** rather than bake defaults in. The data files are never deleted.

---

## 9. Fallback rules

The data-file fallback applies ONLY when:
- (a) the Supabase env vars are missing, OR
- (b) a table has never been seeded, OR
- (c) local development with Supabase unreachable.

When Supabase is configured and a fetch fails:
- retry 3 times with backoff,
- during ISR revalidation, throw (keep last good page),
- during a production build, fail the build loudly.

The data files are never deleted — they are the frozen backup and the fallback.

---

## 10. Editor architecture — the proof table

This is the part that proves the admin can edit everything safely and the public site stays locked.

**The rule:** every editable string on the public site is served from one of three sources, in order:
1. Supabase `content_blocks.value` (published) for editorial copy,
2. Supabase `site_settings` for settings,
3. Supabase tables (`products`, `posts`, `categories`) for catalog data,
with the `/data` files as the fallback when Supabase is unavailable.

**The lock:** the public site never writes. It only reads via `catalog.ts`-style getters that select explicit columns and respect RLS. The Workbench is the only writer, and it enforces roles again in server actions (not just RLS).

**The preview:** the Workbench edits `draft_value` (in `content_drafts`) and the Workbench preview reads drafts; the public site reads only `value` (published). Publish copies draft → published and triggers revalidation.

**The position/visibility/variant rule:** `page_sections` drives order, visibility, and variant. The public site renders sections in `page_sections` order for that page, skips invisible ones, and applies the variant class where one exists. The Workbench cannot move a section to a place the design does not support — the variant options are a fixed enum per section, defined in the app, not free text. So the design is unbreakable from the admin.

---

## 11. What we still need to verify before writing any SQL

These are the Stage 0 verification items that the plan will complete before any write SQL:

1. Run the dashboard SQL inventory (or API) to list every table, view, function, trigger, RLS policy, extension, storage bucket, edge function, and auth-user count. Classify each.
2. Confirm whether `sbfenv` still exists. If it does, flag it as a security problem in the report. Do not delete it until the client says "DELETE APPROVED."
3. Confirm where the Paystack secret key is stored (report only the location, never the value). Exclude it from everything.
4. Confirm the FAQ source (inline in component vs data file) and finalize the string inventory.
5. Confirm the existing `catalog.ts` seam is correct and complete, or fix it in the plan.
6. Confirm whether the public site's `is_active` / `placeholder` concepts map cleanly to the new `status` model, and reconcile.

---

## 12. Decisions I still owe the client

These are the points where the plan needs your input before implementation:

1. **Auth for the Workbench:** Supabase Auth with email/password, or Sign in with Freebuff, or both? The Supabase best-practices skill and the Freebuff Sites/Auth notes are both available; I need to know which identity system the client wants for the Workbench. (Recommended: Supabase Auth email/password for a self-contained studio tool, unless you want Freebuff auth.)
2. **Product status model:** use `is_active` boolean (true = published) for products, and an explicit `status` enum for posts — or one uniform `status` enum across both? Today's seam uses `is_active` for products and `placeholder` for posts. I recommend: products keep `is_active` (it already exists and matches "hide a product"), posts get `status published | draft`. But I can unify if you prefer.
3. **Draft storage:** single `content_blocks` table with column-level privilege on `draft_value`, or two tables (`content_blocks` + `content_drafts`)? Recommended: two tables, because it is the most auditable and impossible to violate by accident.
4. **Preview bridge (Stage 7) scope:** how much of the preview flow do you want now? The minimum is: Workbench edits drafts, Workbench preview reads drafts, publish copies draft → published and revalidates the public site. Do you also want the public site to be able to preview a draft product/post by id (a secured preview route)? That is smaller than a full preview system.
5. **Seed vs. migrate:** do you want the initial schema as a migration (so it can be pushed with `supabase db push`) or as a one-off SQL run from the dashboard? Recommended: migration files under `supabase/migrations/`, pushed once, because that gives you a reproducible schema and a path to roll back. But if you want the fastest first cut, a dashboard SQL run is fine and we can migrate later.
6. **Backups before any deletion:** I will back up the remote public schema and any existing objects to a local folder outside both repos (`C:\Users\ROG ZEPHYRUS\Projects\cra7ty-backups`) before any deletion. Confirm that path is fine, or give me a different one.

---

## 13. Out of scope (stated again, clearly)

- Payments, Paystack, order processing beyond the existing WhatsApp flow. Do not touch the Paystack secret location.
- Free pixel positioning in the admin. The design is locked; the admin controls order/visibility/variant only.
- Deleting the `/data` files. They stay as fallback and backup.
- Any change to the public site's visual design. Pixel-identical after wiring, before the client changes anything.

---

*Spec written from Stage 0 read-only inventory. Next step: the implementation plan, which starts from this spec and stops for your approval before any write SQL or project creation.*
