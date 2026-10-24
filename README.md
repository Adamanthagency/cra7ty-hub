# Cra7ty Hub

A single-page site and product routes for a Lagos paper studio: handfolded
origami, pressed paper tableware, party packs and gift wrap. Orders go to
WhatsApp — there is no payment gateway anywhere in the project.

Next.js 14 (App Router) · TypeScript · Tailwind · three.js via
@react-three/fiber and @react-three/drei · Framer Motion · GSAP ScrollTrigger.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build, fully static
npm start        # serve the build
npm run lint     # next lint
npm run typecheck
```

The build needs network access on the first run only, because `next/font`
fetches Instrument Serif, Schibsted Grotesk and JetBrains Mono from Google
Fonts at build time. After that the fonts are self-hosted from
`/_next/static/media`.

## Where to change things

| What | Where |
| --- | --- |
| **WhatsApp number** | `src/data/site.ts` → `site.whatsappNumber` |
| Instagram, email, address | `src/data/site.ts` → `site` |
| Products, prices, copy | `src/data/products.ts` |
| Hero, marquee, process steps, FAQ lede, footer | `src/data/site.ts` |
| Bulk discount tiers | `src/data/products.ts` → `bulkTiers` |
| FAQ questions | `src/data/products.ts` → `faqs` |
| Testimonials | `src/data/site.ts` → `testimonials` |

### The WhatsApp number

One line, at the top of `src/data/site.ts`:

```ts
whatsappNumber: '234XXXXXXXXXX', // <-- edit this
```

International format, no `+`, no spaces, no dashes — that is the form `wa.me`
expects. `whatsappDisplay` is only the human-readable label shown in the
drawer and the footer, so it can keep its spaces.

Every order link is built in `src/lib/whatsapp.ts`. `buildOrderMessage()`
produces the text, `whatsappOrderLink()` wraps it into a `wa.me` URL. The
message carries each line, the quantity, the line total and the order total:

```
Hello Cra7ty Hub, I would like to place an order:

1. Origami crane, single — 1 × ₦1,500 = ₦1,500
2. Paper plates, 9-inch — 2 × ₦4,500 = ₦9,000

Order total: ₦7,500
Units: 3 across 2 lines

My delivery city and street:
Preferred date:
```

### Adding a product

Append one object to `products` in `src/data/products.ts`. Required: `id`,
`slug`, `name`, `category`, `price`, `description`, `model`, `detail[]` and
`specs[]`. `model` picks which procedural 3D model represents it — one of
`crane | plate | spoon | box | flower | cup | sheet`. `generateStaticParams`
in `src/app/products/[slug]/page.tsx` picks the new route up automatically.

## Structure

```
public/
  og.svg                    social share card (1200 x 630)
src/
  app/
    layout.tsx              fonts, metadata, grain, providers, cursor
    page.tsx                the single page
    icon.svg                favicon (folded crane)
    globals.css             palette variables, grain, buttons, dog-ears
    products/[slug]/page.tsx  product detail, statically generated
  data/
    products.ts             products, categories, bulk tiers, FAQs
    site.ts                 brand config, nav, hero, process, testimonials
  lib/
    types.ts                shared types
    format.ts               naira() and friends
    whatsapp.ts             message builder and wa.me links
    order-store.tsx         order context, reducer, localStorage
    use-env.ts              WebGL / reduced-motion / small-screen checks
  components/
    primitives/             Container, Section, Button, MonoLabel, Marquee,
                            FoldDivider, DogEarCard, Reveal, Icons
    three/
      crane.ts              procedural crane BufferGeometry
      product-models.ts     lathe, extrude and folded-plane models
      paper-material.ts     canvas-generated paper bump texture
      CraneHeroScene.tsx    hero canvas
      ProductViewerScene.tsx  draggable viewer
      FoldSequenceScene.tsx   scroll-scrubbed fold
      fallbacks.tsx         flat SVG art for every model
    sections/               one file per page section
    OrderDrawer.tsx         slide-in order panel
    CustomCursor.tsx        vermilion cursor
    AddToOrderButton.tsx
```

## Decisions worth knowing

**Everything 3D is procedural.** No glTF, no textures, no CDN. The crane is
about forty triangles pushed straight into a `BufferGeometry`; the plate and
cup are lathe profiles; the spoon is an extruded bezier; the box and the crane
wings are folded planes. The only "texture" is a paper bump map drawn on a
2D canvas at runtime in `paper-material.ts`. This is why the site works
offline and why the first-load JS stays at 147 kB with three.js code-split
into lazy chunks.

**The 3D never mounts unless it is safe to.** `useShouldMount3D()` probes
WebGL with a throwaway context, checks `prefers-reduced-motion`, and requires
a viewport of at least 768px. If any check fails — or during SSR — the
component renders `fallbacks.tsx` instead, which is the same folded-paper
drawing used on the product cards. On a phone there is no canvas at all.

**Resources are disposed.** Every geometry and material goes through
`useDisposable`, and the shared bump texture is reference-counted and released
when the last consumer unmounts. The product viewer rebuilds its bundle when
the model key changes and disposes the previous one, so walking across the
categories does not pile up geometry.

**The fold sequence is a real fold, not a swapped sprite.** The sheet is a
genuine folded surface: thirteen stations along a spine, each carrying a
crease point and two edges, so the paper has a centre crease running its whole
length and a shallow V cross section. That V angle is the only hinge the
sequence uses. At zero it is a flat square; at fifty degrees it is a tent with
one lit panel and one shadowed panel — a fold in half; at sixteen degrees, with
the neck and tail strips still narrow, the broad body panels lift into wings
while the head and tail stay put. Ten keyframes drive it: the first five sit
exactly on the midpoint of the scroll range their caption owns, and the later
ones fall between captions that share the same shape of fold. Spine and width
interpolate together so the paper never tears. `flatShading` is what sells it:
three.js derives each facet normal in the shader, so every panel catches the
key light at its own value.

**Only the twelve real folds are named.** `fold-steps.ts` lists the actual
sequence: fold in half, crease the diagonals, collapse the base, petal fold,
reverse fold, neck up, tail up, set the wings.

**Motion is deliberately small.** Scroll reveals travel 24px. The only scrubbed
animation in the project is the fold. The custom cursor and the marquee both
stop under `prefers-reduced-motion`, and Framer Motion's `useReducedMotion`
drops the drawer slide to a fade.

**One markup per breakpoint.** The featured grid renders once and reflows, and
the categories render once with the preview swapping in place. Rendering
mobile and desktop variants separately would duplicate the products for
crawlers.

## Known placeholders

The three testimonials are invented. They are marked `placeholder: true` in
`src/data/site.ts` and render with a "Placeholder" flag next to the name, so
they cannot be mistaken for real quotes. Replace them and set the flag to
`false`.

The WhatsApp number is a placeholder by design — see above.

The social share card is `public/og.svg`. It is a hand-authored SVG rather
than a generated PNG: `next/og` fails to prerender on this Node/Windows
combination (`@vercel/og` throws `Invalid URL`), and a build-time PNG encoder
is not worth the dependency. Most scrapers that require a raster image will
fall back to the `og:title` and `og:description` tags, which are set. If you
want a PNG, drop one at `public/og.png` and change the two `images` entries
in `src/app/layout.tsx`.

## Verified

Checked against a production build (`next build && next start`), not the dev
server:

- `npm run build` exits 0; 16 static pages, no type or lint errors.
- Order drawer: steppers move quantity and totals ₦14,000 → ₦28,000 → ₦14,000,
  and driving a line to zero removes it and shows the empty state.
- WhatsApp link: base `wa.me/234XXXXXXXXXX`, message lists each line with
  quantity and line total, `Order total: ₦22,500` for a four-item order.
- Drawer is a real modal: focus moves into it on open, Escape closes it, focus
  returns to the button that opened it, body scroll is locked while open.
- 3D mounts only above 768px with WebGL; at 360px there are zero canvases and
  the SVG fallbacks render instead.
- No horizontal overflow at 360, 1440 or 1920.
- Fold sequence scrubbed against a production build, reading each caption at
  its midpoint: 01 is a valley fold, 02 a layered packet, 03 and 04 the scored
  square, 05 the collapsed base, 06 the layers drawn out of it, 09 the bird
  taking shape, and 12 a crane with a swept wing, a tail spike and a vermilion
  beak. Captions track the scroll (01 → 03 → 06 → 09 → 12 at 5%, 25%, 50%,
  75%, 99%) and the page logs no console or WebGL errors.