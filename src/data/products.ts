import type { BulkTier, Category, FaqItem, Product } from '@/lib/types';

/**
 * Every product the studio sells. Prices are whole naira.
 * `model` picks which procedural three.js model represents the product.
 * Nothing here is rendered by a component that hardcodes its own copy.
 */
export const products: Product[] = [
  {
    id: 'crane-single',
    slug: 'origami-crane-single',
    name: 'Origami crane, single',
    category: 'origami',
    price: 1500,
    model: 'crane',
    badge: 'Handfolded',
    description: 'One crane folded from a single 15 cm square, wings held open with a light starch.',
    packCount: '1 crane',
    size: '15 cm square sheet',
    detail: [
      'Folded from one square of 80 gsm recycled origami paper. No glue, no wire, no staples.',
      'The wings are set with a trace of starch so the bird holds its shape on a shelf instead of slumping.',
      'Each crane ships in its own kraft pocket so it does not arrive with a broken neck.',
    ],
    specs: [
      { label: 'Sheet size', value: '15 cm square' },
      { label: 'Paper weight', value: '80 gsm recycled' },
      { label: 'Height folded', value: '13 cm' },
      { label: 'Folded in', value: 'Lagos, by hand' },
    ],
  },
  {
    id: 'crane-string-20',
    slug: 'origami-crane-string-20',
    name: 'Origami crane string, 20 pieces',
    category: 'origami',
    price: 12000,
    model: 'crane',
    badge: 'Most ordered',
    description: 'Twenty cranes on cotton thread, strung and knotted ready to hang across a doorway.',
    packCount: '20 cranes',
    size: 'Thread span 2.4 m',
    detail: [
      'Twenty cranes, each folded from a 15 cm square, threaded on waxed cotton cord.',
      'The knots are double-overhand so the string can carry the weight of its own cranes.',
      'Twenty-five per cent cheaper than buying singles, and we throw in the spare thread.',
    ],
    specs: [
      { label: 'Quantity', value: '20 cranes' },
      { label: 'Thread', value: 'Waxed cotton, 2.4 m' },
      { label: 'Spacing', value: '12 cm' },
      { label: 'Weight on hang', value: '48 g' },
    ],
  },
  {
    id: 'flower-bouquet-12',
    slug: 'paper-flower-bouquet-12',
    name: 'Paper flower bouquet, 12 stems',
    category: 'origami',
    price: 9500,
    model: 'flower',
    description: 'Twelve folded stems in kraft and vermilion, banded with a paper wrap and a twine tie.',
    packCount: '12 stems',
    size: '38 cm tall',
    detail: [
      'Each stem is a folded card stem carrying a three-layer paper bloom. No wire armature inside the petals.',
      'Six blooms in kraft, six in vermilion, so the bouquet reads as two tones from across a room.',
      'Twine-tied at the cut end. Keep it out of water; paper stems do not like water.',
    ],
    specs: [
      { label: 'Stems', value: '12' },
      { label: 'Height', value: '38 cm' },
      { label: 'Tones', value: 'Kraft and vermilion' },
      { label: 'Vase life', value: 'Dry only' },
    ],
  },
  {
    id: 'gift-box-set-5',
    slug: 'origami-gift-box-set-5',
    name: 'Origami gift box, set of 5',
    category: 'gift',
    price: 6000,
    model: 'box',
    description: 'Five flat-packed fold-up boxes that close with two folds and no adhesive.',
    packCount: '5 boxes',
    size: '15 x 15 x 8 cm',
    detail: [
      'The box closes with a blintz fold: two flaps meet in the middle and hold under their own tension.',
      'Delivered flat in a board sleeve, folds up in about fifteen seconds each.',
      'Kraft outside, paper inside. Good enough to post as a gift box on its own.',
    ],
    specs: [
      { label: 'Quantity', value: '5 boxes' },
      { label: 'Closed size', value: '15 x 15 x 8 cm' },
      { label: 'Board', value: '1.2 mm greyboard' },
      { label: 'Adhesive needed', value: 'None' },
    ],
  },
  {
    id: 'plates-9in-25',
    slug: 'paper-plates-9-inch-25',
    name: 'Paper plates, 9-inch',
    category: 'table',
    price: 4500,
    model: 'plate',
    badge: 'Bagasse',
    description: 'Twenty-five rigid plates pressed from bagasse with a rolled rim that will not cut a finger.',
    packCount: '25 plates',
    size: '9 inch / 23 cm',
    detail: [
      'Pressed from sugarcane bagasse, not coated paper, so they go in a home compost within weeks.',
      'The rim is rolled rather than cut, which is why they can carry a full plate of jollof without flexing.',
      'Microwave safe. They will not survive a dishwasher, and we would rather say so.',
    ],
    specs: [
      { label: 'Quantity', value: '25 plates' },
      { label: 'Diameter', value: '23 cm / 9 in' },
      { label: 'Material', value: 'Sugarcane bagasse' },
      { label: 'Microwave', value: 'Yes' },
    ],
  },
  {
    id: 'plates-7in-25',
    slug: 'paper-plates-7-inch-25',
    name: 'Paper plates, 7-inch',
    category: 'table',
    price: 3500,
    model: 'plate',
    description: 'Twenty-five side plates for salads, small chops and the children who want their own.',
    packCount: '25 plates',
    size: '7 inch / 18 cm',
    detail: [
      'The smaller press of the same bagasse plate, for anything that would look lost on the 9-inch.',
      'Flat, firm, and light enough that a guest can hold one in one hand while serving themselves.',
      'Comes in the same kraft tone as the 9-inch, so mixed tables still look like one table.',
    ],
    specs: [
      { label: 'Quantity', value: '25 plates' },
      { label: 'Diameter', value: '18 cm / 7 in' },
      { label: 'Material', value: 'Sugarcane bagasse' },
      { label: 'Best for', value: 'Salads, sides, children' },
    ],
  },
  {
    id: 'spoons-50',
    slug: 'paper-spoons-50',
    name: 'Paper spoons',
    category: 'table',
    price: 3000,
    model: 'spoon',
    description: 'Fifty cut-paper spoons with a stacked rim, stiff enough to scoop without bending.',
    packCount: '50 spoons',
    size: '13 cm long',
    detail: [
      'Die-cut from coated kraft in two plies, which is what stops them folding in half in the bowl.',
      'The bowl is pressed rather than printed, so the spoon has an actual dish to hold liquid.',
      'Firm enough for jollof and soft enough that they can go straight into the compost.',
    ],
    specs: [
      { label: 'Quantity', value: '50 spoons' },
      { label: 'Length', value: '13 cm' },
      { label: 'Material', value: 'Coated kraft, 2 plies' },
      { label: 'Dish depth', value: '5 mm pressed' },
    ],
  },
  {
    id: 'cups-8oz-50',
    slug: 'paper-cups-8oz-50',
    name: 'Paper cups, 8oz',
    category: 'table',
    price: 3800,
    model: 'cup',
    description: 'Fifty double-wall cups that hold a cold drink without sweating through the table.',
    packCount: '50 cups',
    size: '8 oz / 240 ml',
    detail: [
      'Double wall, so a cold drink does not leave a ring on a table you care about.',
      'Unbleached board with a food-safe lining, so the cup looks like paper and not like a cup.',
      'Takes a rolled rim. Stacks flat against a bagasse plate in the party pack.',
    ],
    specs: [
      { label: 'Quantity', value: '50 cups' },
      { label: 'Volume', value: '240 ml / 8 oz' },
      { label: 'Wall', value: 'Double' },
      { label: 'Lining', value: 'Food-safe PE' },
    ],
  },
  {
    id: 'party-pack-20',
    slug: 'party-pack-20-guests',
    name: 'Party pack, 20 guests',
    category: 'party',
    price: 14000,
    model: 'cup',
    badge: 'Event ready',
    description: 'Plates, cups, spoons and napkins counted for twenty people, tied in one kraft band.',
    packCount: 'Serves 20',
    size: '20 place settings',
    detail: [
      'Per guest: one 9-inch plate, one side plate, one spoon, one cup and two napkins.',
      'Counted and banded in a kraft sleeve with the guest number written on the outside.',
      'Ordered by 500 for a Saturday, everything is packed and ready for pickup on Friday evening.',
    ],
    specs: [
      { label: 'Serves', value: '20 guests' },
      { label: 'Includes', value: 'Plates, cups, spoons, napkins' },
      { label: 'Pack size', value: '2 kraft sleeves' },
      { label: 'Lead time', value: '24 hours in Lagos' },
    ],
  },
  {
    id: 'origami-paper-100',
    slug: 'origami-paper-pack-100',
    name: 'Origami paper pack, 100 sheets',
    category: 'paper',
    price: 3500,
    model: 'sheet',
    description: 'One hundred 15 cm squares in eleven colours, thin enough to fold but thick enough to hold a crease.',
    packCount: '100 sheets',
    size: '15 cm square, 80 gsm',
    detail: [
      'Eleven colours, one hundred sheets, shuffled by hand so no two runs of paper look the same.',
      '80 gsm. Light enough to fold quickly, heavy enough that the crease stays where you put it.',
      'Ten of the hundred are double-sided in vermilion for the finishing fold.',
    ],
    specs: [
      { label: 'Quantity', value: '100 sheets' },
      { label: 'Size', value: '15 cm square' },
      { label: 'Weight', value: '80 gsm' },
      { label: 'Colours', value: '11, shuffled' },
    ],
  },
  {
    id: 'gift-wrap-10',
    slug: 'gift-wrap-pack-10',
    name: 'Gift-wrap pack, 10 sheets',
    category: 'gift',
    price: 4000,
    model: 'sheet',
    description: 'Ten large wrap sheets with a printed fold grid on the reverse, so corners land square.',
    packCount: '10 sheets',
    size: '70 x 50 cm',
    detail: [
      'Ten sheets at 70 by 50 cm, which wraps a box up to roughly 35 cm on its longest side.',
      'The reverse carries a light fold grid, so the ends line up without a ruler or a fight.',
      'Kraft ground with a vermilion edge stripe. Creases in kraft tape it, you do not need to.',
    ],
    specs: [
      { label: 'Quantity', value: '10 sheets' },
      { label: 'Size', value: '70 x 50 cm' },
      { label: 'Reverse', value: 'Printed fold grid' },
      { label: 'Finish', value: 'Vermilion edge stripe' },
    ],
  },
];

export const getProductBySlug = (slug: string) =>
  products.find((p) => p.slug === slug);

export const getProductById = (id: string) => products.find((p) => p.id === id);

export const getProductsByCategory = (category: Category['id']) =>
  products.filter((p) => p.category === category);

/** Products picked out for the featured strip in /data/site.ts. */
export const featuredIds = [
  'crane-string-20',
  'party-pack-20',
  'flower-bouquet-12',
  'gift-box-set-5',
  'plates-9in-25',
  'origami-paper-100',
];

export const categories: Category[] = [
  {
    id: 'origami',
    index: '01',
    name: 'Origami & sculpture',
    blurb: 'Cranes, flowers, animals and wall pieces. Folded one at a time, in the studio, by hand.',
    model: 'crane',
    count: 3,
  },
  {
    id: 'table',
    index: '02',
    name: 'Paper table',
    blurb: 'Plates, spoons and cups pressed from bagasse and kraft. Sizes that fit a real table.',
    model: 'plate',
    count: 4,
  },
  {
    id: 'party',
    index: '03',
    name: 'Party packs',
    blurb: 'Counted, banded and ready for twenty to two hundred guests. Nothing left to guess.',
    model: 'cup',
    count: 1,
  },
  {
    id: 'gift',
    index: '04',
    name: 'Gift & wrap',
    blurb: 'Boxes that close with two folds, plus wrap sheets printed with a grid on the back.',
    model: 'box',
    count: 2,
  },
  {
    id: 'bulk',
    index: '05',
    name: 'Bulk & events',
    blurb: 'Weddings, naming ceremonies, school events and the small businesses that buy monthly.',
    model: 'flower',
    count: 0,
  },
  {
    id: 'paper',
    index: '06',
    name: 'Origami paper',
    blurb: 'Loose sheets in eleven colours, 80 gsm, shuffled by hand before they are bagged.',
    model: 'sheet',
    count: 1,
  },
];

/** Tiered discount table, printed in mono type in the kraft band. */
export const bulkTiers: BulkTier[] = [
  { from: 50, to: 99, discount: '5%', note: 'Order total, any mix of lines' },
  { from: 100, to: 249, discount: '10%', note: 'Custom colours open at 100' },
  { from: 250, to: 499, discount: '15%', note: 'We fold in two shifts' },
  { from: 500, to: null, discount: 'Quoted', note: 'Named account, 50% deposit' },
];

export const faqs: FaqItem[] = [
  {
    q: 'How do I pay?',
    a: 'There is no payment gateway on this site. We confirm your order on WhatsApp first, then you pay by bank transfer, by cash at the Lagos studio, or by POS if you want to collect in person. Nothing is folded, and nothing ships, until the transfer clears.',
  },
  {
    q: 'How long does delivery take?',
    a: 'Lagos is same day when you order before 2pm. Abuja, Port Harcourt and Ibadan are two to three working days by parcel. Everywhere else in Nigeria is three to five working days, and we will hand it to a bus terminal if that is cheaper for you. A 200-guest party pack needs five to seven working days before it is ready.',
  },
  {
    q: 'Can you make it in our colours?',
    a: 'Yes, from 200 units. Send a hex code or a photograph of your event colours and we will press to that shade. Custom colour adds five to seven working days because the sheets have to be dyed and dried before anyone folds them.',
  },
  {
    q: 'What does bulk pricing look like?',
    a: 'Five per cent off from 50 units, ten from 100, fifteen from 250, and a quoted rate from 500. The discount applies to the order total rather than to each line, so mixing lines still counts. Lagos delivery is free over fifty thousand naira.',
  },
  {
    q: 'What if the paper arrives creased?',
    a: 'Paper does crease in transit. Send a photograph within 24 hours of delivery and we will replace the pack free, or refund it in full if you have already opened it. You do not have to argue about it and we do not ask you to keep the damaged pack.',
  },
  {
    q: 'Do you fold custom designs?',
    a: 'We do. Send a sketch, a logo or a photograph of the thing you want and we will fold one as a sample before quoting the rest. Custom folds start at three days for a sample and ten days for a run of fifty.',
  },
  {
    q: 'Where do I get my digital download?',
    a: 'The confirmation email arrives the moment your payment clears, with a link for every file you bought — and the success page shows the same links straight away. Open My Order in the menu any time (order number plus the email or phone you paid with) to see them again. Save each file as you download it: every file downloads once, so if you lose it you will need to buy it again or message the studio.',
  },
];

/** Product ids that make up the category counts, kept next to the products. */
export const categoryCount: Record<string, number> = {
  origami: 3,
  table: 4,
  party: 1,
  gift: 2,
  bulk: 0,
  paper: 1,
};