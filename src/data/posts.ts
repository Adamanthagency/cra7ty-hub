import type { BlogPost } from '@/lib/types';

/**
 * Studio notes for /blog. Every fact in here is lifted from /data/site.ts,
 * /data/products.ts or the named folds in the 3D layer, so a note can never
 * contradict the shop.
 *
 * All five are placeholders, flagged `placeholder: true` and rendered with a
 * visible chip. Replace the text, set the flag to false, and the chip goes.
 * A backend plugs in here: this array is the seam.
 */
export const posts: BlogPost[] = [
  {
    slug: 'counting-a-two-hundred-guest-order',
    title: 'Counting a two-hundred guest order',
    titleLines: ['Counting a', 'two-hundred guest order'],
    standfirst:
      'A two-hundred guest pack is two hundred plates, two hundred side plates, two hundred spoons, two hundred cups and four hundred napkins. The counting is the job.',
    excerpt:
      'Two hundred of five things, banded into sleeves with the number written on the outside. Why a party pack takes days rather than hours.',
    date: '2026-10-06',
    minutes: 4,
    category: 'Studio practice',
    model: 'cup',
    body: [
      'A party pack is not a pile. Each guest gets one 9-inch plate, one side plate, one spoon, one cup and two napkins, and at two hundred guests that is a thousand separate pieces of paper before a single one of them is folded.',
      'The pieces are counted into sleeves in fives and tens, then banded, then counted again against the guest number written on the outside of the sleeve. A pack of twenty goes out in two kraft sleeves; a pack of two hundred goes out in twenty, each one light enough to carry with one hand and heavy enough that nobody shakes it open to check.',
      'Counting is why a two-hundred guest order needs five to seven working days rather than one. The folding is fast. Making sure the two hundredth cup is in the two hundredth sleeve is the part that cannot be rushed, and it is done by hand, at the table, with the radio on.',
      'Ordered by 500 for a Saturday and everything is packed and ready for pickup on Friday evening. Same-day Lagos delivery covers the small orders; for the big ones we would rather you collected, or sent a rider who can lift twenty sleeves.',
    ],
    relatedProductIds: ['party-pack-20', 'plates-9in-25'],
    placeholder: true,
  },
  {
    slug: 'why-bagasse-plates-hold-hot-food',
    title: 'Why bagasse plates hold hot food',
    titleLines: ['Why bagasse', 'plates hold hot food'],
    standfirst:
      'Pressed from sugarcane bagasse rather than coated paper, with a rolled rim. Both details are why a plate of jollof does not fold in the hand.',
    excerpt:
      'Sugarcane waste, pressed under heat, and a rim that is rolled rather than cut. What that means at a table of hot food.',
    date: '2026-09-22',
    minutes: 3,
    category: 'Materials',
    model: 'plate',
    body: [
      'Bagasse is what is left after sugarcane is crushed for its juice. Pressed under heat it becomes a rigid sheet, and that is what our plates are stamped from — not coated paper, not plastic-lined board.',
      'The rim is rolled rather than cut. A cut rim is a fold waiting for a full plate of jollof; a rolled rim carries the weight around the edge, which is why the 9-inch holds a full plate without flexing. The 7-inch is the same press, smaller, for salads, sides and the children who want their own.',
      'They are microwave safe and they will not survive a dishwasher, and we would rather say so than sell a pack twice. After the event they go into a home compost and are gone before the next birthday — bagasse rots in weeks, not centuries.',
      'Both sizes come out in the same kraft tone, so a table that runs out of 9-inches mid-service can borrow the side plates and nobody notices the swap.',
    ],
    relatedProductIds: ['plates-9in-25', 'plates-7in-25'],
    placeholder: true,
  },
  {
    slug: 'how-a-crane-is-folded',
    title: 'How a crane is folded',
    titleLines: ['How a crane', 'is folded'],
    standfirst:
      'One 15 cm square, twelve named folds, no glue, no wire, no staples. The sequence a pair of hands makes in the studio, in order.',
    excerpt:
      'From a flat square to a bird with its wings set: the twelve folds, in the order they are made — and where the starch comes in.',
    date: '2026-09-08',
    minutes: 5,
    category: 'The fold',
    model: 'crane',
    body: [
      'Every crane starts as one square of 80 gsm recycled paper, fifteen centimetres a side. The paper is the spec, not a suggestion: thinner will not hold the wings open, thicker cracks at the crease.',
      'The sequence is twelve folds and it has names. Fold in half, fold in half again, crease both diagonals, open back to a square, collapse the base. Then the petal fold — twice, once in front, once behind — a reverse fold for the head, the neck up, the tail up, and the wings set last.',
      'Nothing is glued and nothing is stapled. The bird holds its shape because the layers hold each other, and because the wings get a trace of starch so they stand open on a shelf instead of slumping by the following week.',
      'A single crane ships in its own kraft pocket so it does not arrive with a broken neck. Twenty on a string are threaded on waxed cotton, twelve centimetres apart, knotted double-overhand so the string carries its own forty-eight grams across 2.4 metres of cord.',
    ],
    relatedProductIds: ['crane-single', 'crane-string-20', 'origami-paper-100'],
    placeholder: true,
  },
  {
    slug: 'how-the-bulk-tiers-work',
    title: 'How the bulk tiers work',
    titleLines: ['How the bulk', 'tiers work'],
    standfirst:
      'Five per cent off from fifty units, ten from a hundred, fifteen from two hundred and fifty, a quoted rate from five hundred. Applied to the order total, not to each line.',
    excerpt:
      'The discount counts the whole order, not each line, which is why mixing plates with boxes still earns the break. The four tiers, in plain numbers.',
    date: '2026-08-18',
    minutes: 3,
    category: 'Pricing',
    model: 'box',
    body: [
      'Volume pricing starts at fifty units and works on the order total rather than per line. Two hundred plates and a hundred napkins are three hundred units between them, so the fifteen per cent tier applies to the whole invoice, not just to the biggest box on it.',
      'The tiers: fifty to ninety-nine units, five per cent off. One hundred to two hundred and forty-nine, ten per cent. Two hundred and fifty to four hundred and ninety-nine, fifteen per cent — that is the range where we fold in two shifts. From five hundred units the rate is quoted, on a named account with a fifty per cent deposit.',
      'Lagos delivery is free above fifty thousand naira, on top of any tier discount. Custom colours are a separate conversation: send a hex code or a photograph of the event colours and expect five to seven working days on top, because the sheets are dyed and dried before anyone folds them.',
      'Every quote is written from your list, not from ours. Send the guest count and the colour on WhatsApp and you get a number the same day — bank transfer, cash at the studio, or POS. There is no payment gateway anywhere on this site.',
    ],
    relatedProductIds: ['party-pack-20', 'crane-string-20'],
    placeholder: true,
  },
  {
    slug: 'flat-shipping-across-nigeria',
    title: 'Flat shipping across Nigeria',
    titleLines: ['Flat shipping', 'across Nigeria'],
    standfirst:
      'Everything leaves the studio flat. A fortnight of tableware for a hundred people rides in a carton the size of a shoebox — which is the whole point.',
    excerpt:
      'Lagos same day before 2pm, two to five working days nationwide, and why flat packing is the reason a paper order survives a bus terminal.',
    date: '2026-08-04',
    minutes: 3,
    category: 'Shipping',
    model: 'sheet',
    body: [
      'Flat is a feature. A fortnight of tableware for a hundred people rides in a courier carton the size of a shoebox — roughly a fifth of the space the same count in rigid plastic would need, and a fifth of the weight a rider has to carry up to a third-floor flat.',
      'Lagos is same day when the order lands before 2pm, or collect from the studio in Surulere. Abuja, Port Harcourt and Ibadan are two to three working days by parcel. Everywhere else is three to five working days, and if a bus terminal is cheaper than the courier we will hand it to the terminal and send you the waybill.',
      'Paper survives the trip because it is packed flat and counted before it is taped: plates in stacks of twenty-five, spoons and cups banded, origami in kraft pockets, gift-wrap sheets in a board sleeve. If something does crease in transit, a photograph within twenty-four hours gets the pack replaced free.',
      'The folded pieces are the exception — cranes, boxes, flowers. Those travel in sleeves, in a box that keeps them from being leaned on, and they are the reason every carton gets marked before it leaves the table.',
    ],
    relatedProductIds: ['gift-wrap-10', 'origami-paper-100'],
    placeholder: true,
  },
];

export const getPostBySlug = (slug: string) => posts.find((post) => post.slug === slug);

/** Newest first — the order the index and the lead band use. */
export const getAllPosts = () =>
  [...posts].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

/** 2026-10-06 -> "06 Oct 2026". UTC forced so server and client agree. */
export function formatPostDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
