const cheerio = require("cheerio");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ─── RRP TABLE (UK official retail prices) ─────────────────────────────────
// Sources: Pokemon Center UK, official retailer SRPs, May 2026
const RRP = {
  // Generic fallbacks by product type
  "booster box":              144.99,
  "half booster box":          74.99,
  "half box":                  74.99,
  "elite trainer box":         49.99,
  "etb":                       49.99,
  "booster bundle":            24.99,
  "booster pack":               4.99,  // SV era £4.99 (was £4.49 in SwSh)
  "mini tins":                 22.99,
  "collection box":            34.99,
  "poster collection":         19.99,
  "build and battle":          24.99,
  "pin collection":            19.99,
  "deluxe pin collection":     34.99,
  "premier deck":              49.99,
  "ultra premium collection": 119.99,
  "upc":                      119.99,
  "league battle deck":        39.99,
  "tin":                       24.99,
  "tins":                      24.99,
  "collector tin":             24.99,
  "blister":                   12.99,
  "blisters":                  12.99,
  "check lane":                 9.99,
  "premium collection":        34.99,
  "special collection":        29.99,
  "figure collection":         24.99,
  "collection chest":          34.99,
  "gift set":                  34.99,
  "battle deck":               14.99,
  "v battle deck":             19.99,
  "trainer kit":               19.99,
  "advent":                    29.99,
};

// ─── MARKET PRICES (eBay UK SOLD listings) ─────────────────────────────────
// Updated May 2026 — sources: eBay UK completed listings, PriceCharting, TCGPlayer
// These are median sold prices for sealed products in Good/Near Mint condition
const MARKET = {
  // ── MEGA EVOLUTION ERA (2026) ──────────────────────────────────────────
  // Ascended Heroes (SV-ME01) – released Jan-Apr 2026, NO traditional booster box
  "ascended heroes elite trainer box":  65,
  "ascended heroes etb":                65,
  "ascended heroes booster bundle":     38,
  "ascended heroes half booster box":   95,
  "ascended heroes half box":           95,
  "ascended heroes booster pack":        7,

  // Destined Rivals (SV-ME02) — median eBay UK sold £95-110 (active £85-120)
  "destined rivals booster box":       105,
  "destined rivals elite trainer box":  52,
  "destined rivals etb":                52,
  "destined rivals booster bundle":     28,
  "destined rivals half booster box":   62,
  "destined rivals half box":           62,
  "destined rivals booster pack":        5.50,

  // Perfect Order (SV-ME03) — released Mar 2026, UK retail ~£160-170
  "perfect order booster box":         165,
  "perfect order elite trainer box":    65,
  "perfect order etb":                  65,
  "perfect order booster bundle":       35,
  "perfect order booster pack":          8,

  // Chaos Rising (SV-ME04) — released May 22 2026 (just launched)
  // Pre-sale and early sold data: £170-200+ booster box
  "chaos rising booster box":          185,
  "chaos rising elite trainer box":     70,
  "chaos rising etb":                   70,
  "chaos rising booster bundle":        38,
  "chaos rising booster pack":           9,

  // Phantasmal Flames (SV-ME05) — Pokemon Center UK RRP £143.64, sold ~£150-165
  // Chase card hype drives above-retail sold prices
  "phantasmal flames booster box":     160,
  "phantasmal flames elite trainer box": 80,
  "phantasmal flames etb":              80,
  "phantasmal flames booster pack":     10,

  // ── SCARLET & VIOLET MAIN SERIES ──────────────────────────────────────
  // Journey Together (SV09) — 2025 set
  "journey together booster box":      115,
  "journey together elite trainer box": 52,
  "journey together etb":               52,
  "journey together booster bundle":    28,
  "journey together half booster box":  68,
  "journey together half box":          68,
  "journey together booster pack":       5,

  // Prismatic Evolutions (SV08.5) — like Evolving Skies, massively popular
  // ETBs were £150+ at launch; stabilising but staying very elevated
  "prismatic evolutions booster box":  220,
  "prismatic evolutions booster bundle": 90,
  "prismatic evolutions elite trainer box": 95,
  "prismatic evolutions etb":           95,
  "prismatic evolutions booster pack":  18,

  // Surging Sparks (SV08)
  "surging sparks booster box":        145,
  "surging sparks elite trainer box":   58,
  "surging sparks etb":                 58,
  "surging sparks booster bundle":      32,
  "surging sparks booster pack":         6,

  // Stellar Crown (SV07)
  "stellar crown booster box":         150,
  "stellar crown elite trainer box":    60,
  "stellar crown etb":                  60,
  "stellar crown booster bundle":       32,
  "stellar crown booster pack":          7,

  // Shrouded Fable (SV06.5)
  "shrouded fable booster box":        100,

  // Twilight Masquerade (SV06)
  "twilight masquerade booster box":   120,
  "twilight masquerade elite trainer box": 50,
  "twilight masquerade etb":            50,
  "twilight masquerade booster bundle":  30,
  "twilight masquerade booster pack":     8,

  // Temporal Forces (SV05)
  "temporal forces booster box":       105,
  "temporal forces elite trainer box":  48,
  "temporal forces etb":                48,
  "temporal forces half booster box":   60,
  "temporal forces half box":           60,

  // Paradox Rift (SV04)
  "paradox rift booster box":          110,
  "paradox rift elite trainer box":     50,
  "paradox rift etb":                   50,
  "paradox rift half booster box":      62,
  "paradox rift half box":              62,
  "paradox rift booster pack":           5,

  // Obsidian Flames (SV03)
  "obsidian flames booster box":       120,
  "obsidian flames elite trainer box":  52,
  "obsidian flames etb":                52,
  "obsidian flames booster bundle":     30,
  "obsidian flames booster pack":       11,

  // Paldea Evolved (SV02)
  "paldea evolved booster box":         95,
  "paldea evolved booster bundle":      28,
  "paldea evolved elite trainer box":   45,
  "paldea evolved etb":                 45,
  "paldea evolved booster pack":         9,

  // Paldean Fates (SV04.5) — shiny vault, premium packs
  "paldean fates booster box":         135,
  "paldean fates booster bundle":       38,
  "paldean fates elite trainer box":    62,
  "paldean fates etb":                  62,
  "paldean fates booster pack":         13,

  // Scarlet & Violet Base (SV01)
  "scarlet violet booster box":        105,
  "scarlet violet elite trainer box":   48,
  "scarlet violet etb":                 48,
  "scarlet violet booster pack":         8,
  "scarlet violet base set booster pack": 8,

  // 151 (SV03.5) — extremely popular, always appreciating
  "151 booster box":                   180,
  "151 booster bundle":                 50,
  "151 elite trainer box":              70,
  "151 etb":                            70,
  "151 booster pack":                    8,

  // ── SWORD & SHIELD ERA ────────────────────────────────────────────────
  // Crown Zenith (SWSH12.5)
  "crown zenith booster box":          130,
  "crown zenith elite trainer box":     62,
  "crown zenith etb":                   62,
  "crown zenith booster pack":          11,

  // Silver Tempest (SWSH12) — Lugia V alt art demand
  "silver tempest booster box":        115,
  "silver tempest elite trainer box":   55,
  "silver tempest etb":                 55,
  "silver tempest booster pack":        11,

  // Lost Origin (SWSH11)
  "lost origin booster box":           125,
  "lost origin elite trainer box":      52,
  "lost origin etb":                    52,
  "lost origin booster pack":            9,

  // Astral Radiance (SWSH10)
  "astral radiance booster box":       125,
  "astral radiance elite trainer box":  50,
  "astral radiance etb":                50,
  "astral radiance booster pack":        8,

  // Brilliant Stars (SWSH09) — Charizard VSTAR
  "brilliant stars booster box":       145,
  "brilliant stars elite trainer box":  58,
  "brilliant stars etb":                58,
  "brilliant stars booster pack":       11,

  // Fusion Strike (SWSH08)
  "fusion strike booster box":         140,
  "fusion strike elite trainer box":    52,
  "fusion strike etb":                  52,
  "fusion strike booster pack":         10,
  "fusion strike build battle box":     28,

  // Evolving Skies (SWSH07) — ICONIC, Umbreon VMAX, always rising
  "evolving skies booster box":        790,
  "evolving skies elite trainer box":  175,
  "evolving skies etb":                175,
  "evolving skies booster pack":        28,

  // Chilling Reign (SWSH06) — Ice/Shadow Rider Calyrex
  "chilling reign booster box":        155,
  "chilling reign elite trainer box":   62,
  "chilling reign etb":                 62,
  "chilling reign booster pack":        13,

  // Battle Styles (SWSH05) — Urshifu demand
  "battle styles booster box":         175,
  "battle styles elite trainer box":    65,
  "battle styles etb":                  65,
  "battle styles booster pack":         12,

  // Shining Fates (SWSH04.5) — premium chase set, Shiny Charizard VMAX
  "shining fates booster box":         245,
  "shining fates elite trainer box":   115,
  "shining fates etb":                 115,
  "shining fates booster pack":         17,

  // Vivid Voltage (SWSH04) — Pikachu VMAX era
  "vivid voltage booster box":         145,
  "vivid voltage elite trainer box":    58,
  "vivid voltage etb":                  58,
  "vivid voltage booster pack":         11,

  // Darkness Ablaze (SWSH03) — Charizard VMAX
  "darkness ablaze booster box":       135,
  "darkness ablaze elite trainer box":  55,
  "darkness ablaze etb":                55,
  "darkness ablaze booster pack":       10,

  // Rebel Clash (SWSH02)
  "rebel clash booster box":           125,
  "rebel clash elite trainer box":      50,
  "rebel clash etb":                    50,
  "rebel clash booster pack":           10,

  // Sword & Shield Base (SWSH01)
  "sword shield base set booster pack": 10,

  // Hidden Fates (SM11.5) — ICONIC, constant appreciation
  "hidden fates booster box":          390,
  "hidden fates elite trainer box":    115,
  "hidden fates etb":                  115,
  "hidden fates booster pack":          15,

  // Cosmic Eclipse (SM12)
  "cosmic eclipse booster box":        340,
  "cosmic eclipse booster pack":        12,

  // Champions Path (SM35) — extremely limited, Shiny Charizard V
  "champions path elite trainer box":  195,
  "champions path booster pack":        25,

  // Unified Minds (SM11)
  "unified minds booster box":         245,
  "unified minds booster pack":         10,

  // Unbroken Bonds (SM10)
  "unbroken bonds booster box":        275,
  "unbroken bonds booster pack":        11,

  // ── TINS (eBay UK sold) ─────────────────────────────────────────────────
  // Hidden Fates tins are iconic — Shiny Charizard tin trades at a premium
  "hidden fates tin":                   45,
  "shining fates tin":                  30,
  "shining fates mini tins":            28,
  "evolving skies tin":                 45,
  "brilliant stars tin":                22,
  "fusion strike tin":                  20,
  "astral radiance tin":                18,
  "lost origin tin":                    18,
  "silver tempest tin":                 18,
  "crown zenith tin":                   20,
  "paldean fates tin":                  22,
  "obsidian flames tin":                20,
  "paradox rift tin":                   20,
  "temporal forces tin":                18,
  "twilight masquerade tin":            18,
  "stellar crown tin":                  20,
  "surging sparks tin":                 22,
  "prismatic evolutions tin":           35,
  "journey together tin":               22,
  "scarlet violet tin":                 18,
  "paldea evolved tin":                 16,
  "chilling reign tin":                 22,
  "battle styles tin":                  22,
  "vivid voltage tin":                  20,
  "darkness ablaze tin":                18,
  "rebel clash tin":                    18,
  "sword shield tin":                   20,

  // ── PREMIUM & SPECIAL COLLECTIONS ──────────────────────────────────────
  "prismatic evolutions premium collection":     90,
  "surging sparks premium collection":           38,
  "stellar crown premium collection":            35,
  "temporal forces premium collection":          32,
  "obsidian flames premium collection":          32,
  "paradox rift premium collection":             32,
  "paldean fates premium collection":            38,
  "paldea evolved premium collection":           28,
  "scarlet violet premium collection":           30,
  "evolving skies premium collection":           65,
  "brilliant stars premium collection":          38,
  "shining fates premium collection":            55,
  "hidden fates premium collection":             75,

  // ── FIGURE COLLECTIONS ──────────────────────────────────────────────────
  "surging sparks figure collection":            28,
  "paradox rift figure collection":              26,
  "obsidian flames figure collection":           24,
  "paldea evolved figure collection":            22,
  "scarlet violet figure collection":            22,
  "evolving skies figure collection":            45,
  "brilliant stars figure collection":           28,
  "fusion strike figure collection":             24,

  // ── BATTLE DECKS ────────────────────────────────────────────────────────
  "surging sparks battle deck":                  18,
  "stellar crown battle deck":                   16,
  "temporal forces battle deck":                 16,
  "obsidian flames battle deck":                 16,
  "paradox rift battle deck":                    15,
  "paldean fates battle deck":                   16,
  "paldea evolved battle deck":                  14,
  "scarlet violet battle deck":                  14,
  "evolving skies battle deck":                  20,
  "brilliant stars v battle deck":               18,
  "fusion strike v battle deck":                 16,

  // ── BLISTER PACKS & CHECK LANE ─────────────────────────────────────────
  "shining fates blister":                       22,
  "hidden fates blister":                        30,
  "evolving skies blister":                      28,
  "brilliant stars blister":                     14,
  "fusion strike blister":                       12,
  "astral radiance blister":                     12,
  "silver tempest blister":                      12,
  "scarlet violet blister":                      10,
  "paldea evolved blister":                       9,
  "obsidian flames blister":                     10,
  "temporal forces blister":                     10,
  "twilight masquerade blister":                 10,
  "stellar crown blister":                       11,
  "surging sparks blister":                      12,
  "prismatic evolutions blister":                28,

  // ── BUILD & BATTLE BOXES ────────────────────────────────────────────────
  "chilling reign build battle box":             30,
  "battle styles build battle box":              30,
  "evolving skies build battle box":             65,
  "brilliant stars build battle box":            28,
  "astral radiance build battle box":            26,
  "lost origin build battle box":                26,
  "silver tempest build battle box":             26,
  "crown zenith build battle box":               24,
  "paldea evolved build battle box":             22,
  "obsidian flames build battle box":            22,
  "paradox rift build battle box":               22,
  "temporal forces build battle box":            22,
  "twilight masquerade build battle box":        22,
  "stellar crown build battle box":              22,
  "surging sparks build battle box":             24,
};

// ─── HOLD DATA — investment potential per set ─────────────────────────────
// holdScore: 1-10 (10 = strongest long-term investment)
// trend: "rising" | "stable" | "declining"
// yr1mult: estimated 12-month price multiplier
const HOLD_DATA = {
  "evolving skies":        { holdScore: 10, trend: "rising",   yr1mult: 1.20, note: "Umbreon VMAX — generational set" },
  "hidden fates":          { holdScore:  9, trend: "rising",   yr1mult: 1.15, note: "Iconic Shiny Vault chase set" },
  "prismatic evolutions":  { holdScore:  9, trend: "rising",   yr1mult: 1.25, note: "Eevee hype — next Evolving Skies" },
  "shining fates":         { holdScore:  8, trend: "stable",   yr1mult: 1.10, note: "Shiny Charizard VMAX drives demand" },
  "champions path":        { holdScore:  8, trend: "rising",   yr1mult: 1.15, note: "Low print run premium set" },
  "cosmic eclipse":        { holdScore:  7, trend: "stable",   yr1mult: 1.08, note: "Last Sun & Moon set" },
  "unified minds":         { holdScore:  6, trend: "stable",   yr1mult: 1.05, note: "Tag Team era favourite" },
  "unbroken bonds":        { holdScore:  6, trend: "stable",   yr1mult: 1.05, note: "Strong tag team lineup" },
  "phantasmal flames":     { holdScore:  7, trend: "rising",   yr1mult: 1.20, note: "Chase cards driving premium" },
  "chaos rising":          { holdScore:  7, trend: "rising",   yr1mult: 1.15, note: "Brand new — early adopter window" },
  "perfect order":         { holdScore:  7, trend: "rising",   yr1mult: 1.12, note: "Mega Zygarde ex chase card £230+" },
  "151":                   { holdScore:  8, trend: "rising",   yr1mult: 1.15, note: "Nostalgia premium — fan favourite" },
  "ascended heroes":       { holdScore:  6, trend: "rising",   yr1mult: 1.10, note: "ME01 — Mega Evo era hype" },
  "paldean fates":         { holdScore:  6, trend: "stable",   yr1mult: 1.08, note: "Shiny vault set" },
  "surging sparks":        { holdScore:  5, trend: "stable",   yr1mult: 1.05, note: "Pikachu ex appeal" },
  "stellar crown":         { holdScore:  5, trend: "stable",   yr1mult: 1.04, note: "Solid modern set" },
  "brilliant stars":       { holdScore:  5, trend: "stable",   yr1mult: 1.05, note: "Charizard VSTAR demand" },
  "journey together":      { holdScore:  5, trend: "stable",   yr1mult: 1.03, note: "Recent release, settling" },
  "destined rivals":       { holdScore:  5, trend: "stable",   yr1mult: 1.05, note: "ME02 — recent ME set" },
  "twilight masquerade":   { holdScore:  4, trend: "stable",   yr1mult: 1.02, note: "Standard modern" },
  "temporal forces":       { holdScore:  4, trend: "stable",   yr1mult: 1.02, note: "Standard modern" },
  "paradox rift":          { holdScore:  4, trend: "declining", yr1mult: 0.98, note: "Higher supply, slow decline" },
  "obsidian flames":       { holdScore:  4, trend: "declining", yr1mult: 0.98, note: "Charizard ex set — print heavy" },
  "shrouded fable":        { holdScore:  4, trend: "stable",   yr1mult: 1.02, note: "Low-hype set" },
  "crown zenith":          { holdScore:  4, trend: "stable",   yr1mult: 1.03, note: "Last SwSh release" },

  // ── SV Base + older SV ──────────────────────────────────────────────────
  "paldea evolved":        { holdScore:  3, trend: "declining", yr1mult: 0.95, note: "Oversupplied SV set" },
  "scarlet violet":        { holdScore:  3, trend: "stable",    yr1mult: 1.00, note: "Base SV — functional set" },

  // ── Sword & Shield era ───────────────────────────────────────────────────
  "silver tempest":        { holdScore:  5, trend: "stable",    yr1mult: 1.05, note: "Lugia V alt art premium" },
  "lost origin":           { holdScore:  4, trend: "stable",    yr1mult: 1.02, note: "Origin Forme demand" },
  "astral radiance":       { holdScore:  3, trend: "stable",    yr1mult: 1.00, note: "Solid but common set" },
  "fusion strike":         { holdScore:  4, trend: "stable",    yr1mult: 1.02, note: "Mew VMAX hype" },
  "chilling reign":        { holdScore:  6, trend: "rising",    yr1mult: 1.08, note: "Ice/Shadow Rider — underrated" },
  "battle styles":         { holdScore:  5, trend: "stable",    yr1mult: 1.05, note: "Urshifu demand — strong" },
  "vivid voltage":         { holdScore:  4, trend: "stable",    yr1mult: 1.02, note: "Pikachu VMAX appeal" },
  "darkness ablaze":       { holdScore:  5, trend: "stable",    yr1mult: 1.04, note: "Charizard VMAX — fan favourite" },
  "rebel clash":           { holdScore:  3, trend: "stable",    yr1mult: 1.00, note: "Standard SwSh set" },
  "sword shield":          { holdScore:  3, trend: "stable",    yr1mult: 1.00, note: "SwSh base — steady" },
  "unbroken bonds":        { holdScore:  6, trend: "stable",    yr1mult: 1.05, note: "Strong tag team lineup" },
};

// ─── VALID ENGLISH POKEMON SETS ────────────────────────────────────────────
const ENGLISH_SETS = [
  "ascended heroes", "destined rivals", "perfect order", "chaos rising", "phantasmal flames",
  "journey together", "prismatic evolutions", "surging sparks", "stellar crown",
  "shrouded fable", "twilight masquerade", "temporal forces", "paradox rift",
  "obsidian flames", "paldea evolved", "paldean fates", "scarlet & violet",
  "scarlet and violet", "151", "crown zenith", "silver tempest", "lost origin",
  "astral radiance", "brilliant stars", "fusion strike", "evolving skies",
  "chilling reign", "battle styles", "shining fates", "vivid voltage",
  "champions path", "darkness ablaze", "rebel clash", "sword & shield",
  "hidden fates", "cosmic eclipse", "unified minds", "unbroken bonds",
  "team up", "lost thunder", "celestial storm", "forbidden light",
  "ultra prism", "burning shadows", "guardians rising", "sun & moon",
];

// ─── SEALED PRODUCT TYPES ──────────────────────────────────────────────────
const PRODUCT_TYPES = [
  // Boxes
  "booster box", "half booster box", "half box",
  // ETBs & trainer boxes
  "elite trainer box", "etb",
  // Bundles & blisters
  "booster bundle", "booster pack",
  "blister", "blisters", "check lane",
  // Tins
  "tin", "tins", "mini tins", "collector tin",
  // Collections
  "ultra premium collection", "premium collection", "special collection",
  "figure collection", "collection box", "collection chest",
  "poster collection", "pin collection", "deluxe pin collection",
  // Battle decks & kits
  "league battle deck", "battle deck", "v battle deck",
  "build and battle", "build & battle",
  "trainer kit", "premier deck",
  // Gift & seasonal
  "gift set", "advent",
];

// ─── HARD BLOCK ────────────────────────────────────────────────────────────
const BLOCK = [
  "korean", "japanese", "simplified chinese", "traditional chinese",
  "gem pack", "sv3a", "sv4a", "sv5k", "sv6a", "sv7", "sv8", "sv9",
  "yugioh", "yu-gi-oh", "magic the gathering", "mtg", "digimon",
  "one piece", "dragon ball", "lorcana", "cardfight", "vanguard",
  "weiss", "buddyfight", "gundam", "naruto", "flesh and blood",
  "code card", "online code", "live code", "single", "graded",
  "psa", "bgs", "cgc", "lot of", "proxy", "fake",
  "sleeve", "playmat", "binder", "dice", "bulk", "funko", "plush",
  "etb case", "booster box case", "case of",
  "korean booster", "japanese booster", "japanese pokemon",
  "glory of team rocket", "ruler of the black flame",
  "ninja spinner", "mega dream ex", "chinese",
  "terastal", "wild force", "cyber judge", "clay burst",
  "union arena", "grand archive", "star wars unlimited",
  "sleeves", "toy figure", "coin blister", "coin card",
  "sealed case", "booster case", "display case",
];

// ─── PRICE SANITY LIMITS PER PRODUCT TYPE ─────────────────────────────────
const PRICE_LIMITS = {
  "booster pack":          { min: 2,  max: 60   },
  "booster box":           { min: 50, max: 1500 },
  "half box":              { min: 30, max: 500  },
  "half booster box":      { min: 30, max: 500  },
  "elite trainer box":     { min: 25, max: 500  },
  "etb":                   { min: 25, max: 500  },
  "booster bundle":        { min: 12, max: 250  },
  "tin":                   { min: 10, max: 200  },
  "tins":                  { min: 10, max: 200  },
  "mini tins":             { min: 8,  max: 60   },
  "collector tin":         { min: 15, max: 200  },
  "blister":               { min: 5,  max: 80   },
  "check lane":            { min: 4,  max: 40   },
  "ultra premium collection": { min: 60, max: 600 },
  "premium collection":    { min: 20, max: 300  },
  "special collection":    { min: 20, max: 300  },
  "figure collection":     { min: 15, max: 200  },
  "collection box":        { min: 20, max: 300  },
  "collection chest":      { min: 25, max: 200  },
  "pin collection":        { min: 10, max: 120  },
  "battle deck":           { min: 8,  max: 80   },
  "v battle deck":         { min: 10, max: 100  },
  "league battle deck":    { min: 15, max: 150  },
  "build and battle":      { min: 15, max: 80   },
  "build & battle":        { min: 15, max: 80   },
  "trainer kit":           { min: 10, max: 60   },
  "premier deck":          { min: 12, max: 100  },
  "gift set":              { min: 20, max: 250  },
  "advent":                { min: 20, max: 120  },
  "default":               { min: 5,  max: 1500 },
};

function getPriceLimits(title) {
  const t = title.toLowerCase();
  for (const [key, limits] of Object.entries(PRICE_LIMITS)) {
    if (t.includes(key)) return limits;
  }
  return PRICE_LIMITS.default;
}

function isValidProduct(title, price) {
  const t = title.toLowerCase();
  const tn = normaliseTitle(title);
  if (BLOCK.some(k => t.includes(k))) return false;
  if (!PRODUCT_TYPES.some(k => tn.includes(normaliseTitle(k)))) return false;
  if (!ENGLISH_SETS.some(s => tn.includes(normaliseTitle(s)))) return false;
  const limits = getPriceLimits(title);
  if (price < limits.min || price > limits.max) return false;
  return true;
}

function normaliseTitle(title) {
  return title.toLowerCase()
    .replace(/\s*[-–—:]\s*/g, " ")
    .replace(/[&]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getRRP(title) {
  const t = normaliseTitle(title);
  const sorted = Object.entries(RRP).sort((a, b) => b[0].length - a[0].length);
  for (const [k, v] of sorted) if (t.includes(normaliseTitle(k))) return v;
  return null;
}

function getMarket(title) {
  const t = normaliseTitle(title);
  const sorted = Object.entries(MARKET).sort((a, b) => b[0].length - a[0].length);
  for (const [k, v] of sorted) if (t.includes(normaliseTitle(k))) return v;
  return null;
}

function getHoldData(title) {
  const t = normaliseTitle(title);
  for (const [set, data] of Object.entries(HOLD_DATA)) {
    if (t.includes(normaliseTitle(set))) return data;
  }
  return null;
}

function getDealRating(buy, rrp, market) {
  const vsMarket = market ? ((buy - market) / market) * 100 : null;
  const flipProfit = market ? (market - buy - (market * 0.13) - 4.00) : null;
  const flipRoi = (flipProfit !== null && buy > 0) ? (flipProfit / buy * 100) : null;

  // Rating is purely based on flip profit potential vs eBay market
  // RRP is irrelevant — what matters is can you make money
  if (flipProfit !== null) {
    if (flipRoi >= 25)  return { label: "🔥 EXCEPTIONAL DEAL", stars: "⭐⭐⭐⭐⭐" };
    if (flipRoi >= 15)  return { label: "🟢 EXCELLENT DEAL",   stars: "⭐⭐⭐⭐⭐" };
    if (flipRoi >= 5)   return { label: "✅ GOOD DEAL",        stars: "⭐⭐⭐⭐" };
    if (flipRoi >= 0)   return { label: "⚖️ BREAK EVEN",       stars: "⭐⭐⭐" };
    if (flipRoi >= -10) return { label: "⚠️ SMALL LOSS",       stars: "⭐⭐" };
    return               { label: "❌ NOT WORTH IT",           stars: "⭐" };
  }

  // No market data — fall back to vs market %
  if (vsMarket !== null) {
    if (vsMarket <= -20) return { label: "🔥 EXCEPTIONAL DEAL", stars: "⭐⭐⭐⭐⭐" };
    if (vsMarket <= -10) return { label: "✅ GOOD DEAL",        stars: "⭐⭐⭐⭐" };
    if (vsMarket <= 0)   return { label: "⚖️ AT MARKET",        stars: "⭐⭐⭐" };
    if (vsMarket <= 20)  return { label: "⚠️ ABOVE MARKET",     stars: "⭐⭐" };
    return                { label: "❌ NOT WORTH IT",           stars: "⭐" };
  }

  return { label: "📦 IN STOCK", stars: "" };
}

// ─── BROWSER-LIKE HEADERS ────────────────────────────────────────────────────
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
  "upgrade-insecure-requests": "1",
};

const JSON_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json, text/javascript, */*; q=0.01",
  "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  "x-requested-with": "XMLHttpRequest",
};

// ─── HTTP FETCH ───────────────────────────────────────────────────────────────
const delay = ms => new Promise(r => setTimeout(r, ms));

async function fetchPage(url, ms = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        ...BROWSER_HEADERS,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Referer": "https://www.google.co.uk/",
      },
    });
    clearTimeout(timer);
    if (res.status === 429) { console.log(`    HTTP 429 — rate limited, will retry next scan`); return null; }
    if (!res.ok) { console.log(`    HTTP ${res.status} — skipping`); return null; }
    return await res.text();
  } catch (e) {
    clearTimeout(timer);
    console.log(`    Error: ${e.message.slice(0, 80)}`);
    return null;
  }
}

async function fetchJson(url, ms = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: JSON_HEADERS });
    clearTimeout(timer);
    if (res.status === 429) { console.log(`    HTTP 429 — rate limited, will retry next scan`); return null; }
    if (!res.ok) { console.log(`    HTTP ${res.status} — skipping`); return null; }
    return await res.json();
  } catch (e) {
    clearTimeout(timer);
    console.log(`    Error: ${e.message.slice(0, 80)}`);
    return null;
  }
}

// ─── SHOPIFY PRODUCTS JSON API ────────────────────────────────────────────────
async function fetchShopifyProducts(baseUrl) {
  const seen = new Set();
  const items = [];

  // Try Pokemon-specific collections first (avoids wading through singles/other TCGs)
  // then fall back to broad endpoints
  const endpoints = [
    `${baseUrl}/collections/pokemon-tcg/products.json`,
    `${baseUrl}/collections/pokemon/products.json`,
    `${baseUrl}/collections/pokemon-sealed/products.json`,
    `${baseUrl}/collections/sealed-product/products.json`,
    `${baseUrl}/collections/sealed/products.json`,
    `${baseUrl}/collections/trading-cards/products.json`,
    `${baseUrl}/products.json`,
    `${baseUrl}/collections/all/products.json`,
  ];

  let workingEndpoint = null;
  for (const ep of endpoints) {
    const probe = await fetchJson(`${ep}?limit=1&page=1`);
    if (probe && Array.isArray(probe.products) && probe.products.length > 0) {
      workingEndpoint = ep;
      break;
    }
    // No delay between probes — 404s fail instantly, no rate-limit risk
  }
  if (!workingEndpoint) return items;

  for (let page = 1; page <= 5; page++) {
    const url = `${workingEndpoint}?limit=250&page=${page}`;
    const data = await fetchJson(url);
    if (!data || !Array.isArray(data.products) || data.products.length === 0) break;

    for (const product of data.products) {
      const title = product.title;
      if (!title) continue;

      const variant = (product.variants || []).find(v => v.available !== false && parseFloat(v.price) > 0);
      if (!variant) continue;

      const price = parseFloat(variant.price);
      if (!price || price <= 0) continue;

      const productUrl = `${baseUrl}/products/${product.handle}`;
      let image = "";
      if (product.images && product.images[0]) {
        const src = product.images[0].src || "";
        image = src.startsWith("//") ? `https:${src}` : src;
      }

      const key = `${title.toLowerCase()}::${Math.round(price)}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push({ title, price, url: productUrl, image });
      }
    }

    if (data.products.length < 250) break;
    await delay(1200);
  }
  return items;
}

// ─── HTML PARSER fallback ─────────────────────────────────────────────────────
function parseShopifyHtml(html, baseUrl) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const items = [];

  const containers = [
    ".product-item", ".product-card", ".grid__item",
    ".card-wrapper", ".productitem", ".collection-product-card",
    "[data-product-id]", "li.product-item",
  ];

  for (const sel of containers) {
    if ($(sel).length === 0) continue;

    $(sel).each((_, el) => {
      let title = "";
      const titleSelectors = [
        ".card__heading a", ".product-item__title a", ".productitem--title a",
        ".product-title a", ".product-card__title a",
        ".card__heading", ".product-item__title", ".productitem--title",
        "h2 a", "h3 a", "h4 a", "h2", "h3", "h4",
      ];
      for (const ts of titleSelectors) {
        const text = $(el).find(ts).first().text().trim();
        if (text && text.length > 4 && !text.includes("<") && !text.includes("src=")) {
          title = text;
          break;
        }
      }
      if (!title) return;

      const rawText = $(el).text();
      const priceMatch = rawText.match(/£\s*([\d,]+\.?\d{0,2})/);
      if (!priceMatch) return;
      const price = parseFloat(priceMatch[1].replace(/,/g, ""));
      if (!price || price <= 0) return;

      let imageUrl = "";
      const img = $(el).find("img").first();
      const src = img.attr("src") || img.attr("data-src") || img.attr("data-srcset") || "";
      if (src) {
        const cleanSrc = src.split(" ")[0];
        imageUrl = cleanSrc.startsWith("//") ? `https:${cleanSrc}` :
                   cleanSrc.startsWith("http") ? cleanSrc : `${baseUrl}${cleanSrc}`;
      }

      const lower = rawText.toLowerCase();
      const soldOut = lower.includes("sold out") || lower.includes("out of stock") ||
        $(el).find(".sold-out, [class*='sold-out']").length > 0;
      if (soldOut) return;

      const link = $(el).find("a[href*='/products/']").first().attr("href") ||
                   $(el).find("a[href]").first().attr("href");
      if (!link) return;
      const productUrl = link.startsWith("http") ? link : `${baseUrl}${link}`;

      const key = `${title.toLowerCase()}::${Math.round(price)}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push({ title, price, url: productUrl, image: imageUrl });
      }
    });

    if (items.length > 0) break;
  }

  // Amazon-specific parser
  if (items.length === 0 && baseUrl.includes("amazon")) {
    $("[data-component-type='s-search-result']").each((_, el) => {
      const title = $(el).find("h2 a span").first().text().trim();
      const priceWhole = $(el).find(".a-price-whole").first().text().trim();
      const priceFrac = $(el).find(".a-price-fraction").first().text().trim();
      const price = parseFloat(`${priceWhole.replace(/,/g, "")}.${priceFrac || "00"}`);
      const link = $(el).find("h2 a").first().attr("href");
      const soldOut = $(el).text().toLowerCase().includes("currently unavailable");
      const imageUrl = $(el).find("img.s-image").first().attr("src") || "";
      if (title && !soldOut && price > 0 && link) {
        const url = link.startsWith("http") ? link : `https://www.amazon.co.uk${link}`;
        const key = `${title.toLowerCase()}::${Math.round(price)}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({ title, price, url, image: imageUrl });
        }
      }
    });
  }

  return items;
}

// ─── SEARCH TERMS ─────────────────────────────────────────────────────────────
const CORE_SEARCHES = [
  "pokemon+booster+box", "pokemon+elite+trainer+box", "pokemon+booster+bundle",
  "pokemon+booster+pack", "pokemon+half+booster+box", "pokemon+tin",
  "pokemon+collection+box", "pokemon+poster+collection", "pokemon+blister",
  "pokemon+ascended+heroes", "pokemon+destined+rivals", "pokemon+perfect+order",
  "pokemon+chaos+rising", "pokemon+phantasmal+flames", "pokemon+journey+together",
  "pokemon+prismatic+evolutions", "pokemon+surging+sparks", "pokemon+stellar+crown",
  "pokemon+shrouded+fable", "pokemon+twilight+masquerade", "pokemon+temporal+forces",
  "pokemon+paradox+rift", "pokemon+obsidian+flames", "pokemon+151",
  "pokemon+paldean+fates", "pokemon+crown+zenith", "pokemon+silver+tempest",
  "pokemon+lost+origin", "pokemon+brilliant+stars", "pokemon+fusion+strike",
  "pokemon+evolving+skies", "pokemon+chilling+reign", "pokemon+battle+styles",
  "pokemon+shining+fates", "pokemon+vivid+voltage", "pokemon+hidden+fates",
  "pokemon+cosmic+eclipse",
];

// ─── RETAILERS ───────────────────────────────────────────────────────────────
const RETAILERS = [
  { name: "Total Cards",    base: "https://totalcards.net",       type: "shopify-json" },
  { name: "Titan Cards",    base: "https://titancards.co.uk",     type: "shopify-json" },
  { name: "Eterna Cards",   base: "https://eternacards.co.uk",    type: "shopify-json" },
  { name: "PACKRAT",        base: "https://packratt.co.uk",       type: "shopify-json" },
  { name: "Double Sleeved", base: "https://doublesleeved.co.uk",  type: "shopify-json" },
  { name: "Toys N Geek",    base: "https://www.toysngeek.co.uk",  type: "shopify-json" },
  { name: "The Card Vault", base: "https://thecardvault.co.uk",   type: "shopify-json" },
  { name: "My TCG",         base: "https://mytcg.co.uk",          type: "shopify-json" },
  { name: "Gathering Games",base: "https://gatheringgames.co.uk",  type: "shopify-json" },
  { name: "Magic Madhouse", base: "https://magicmadhouse.co.uk",   type: "shopify-json" },
  {
    name: "Smyths", base: "https://www.smythstoys.com", type: "html",
    urls: [
      "https://www.smythstoys.com/uk/en-gb/search/?text=pokemon+booster+box",
      "https://www.smythstoys.com/uk/en-gb/search/?text=pokemon+elite+trainer+box",
      "https://www.smythstoys.com/uk/en-gb/search/?text=pokemon+ascended+heroes",
      "https://www.smythstoys.com/uk/en-gb/search/?text=pokemon+destined+rivals",
      "https://www.smythstoys.com/uk/en-gb/search/?text=pokemon+booster+bundle",
    ],
  },
  {
    name: "Argos", base: "https://www.argos.co.uk", type: "html",
    urls: [
      "https://www.argos.co.uk/search/pokemon-booster-box/",
      "https://www.argos.co.uk/search/pokemon-elite-trainer-box/",
      "https://www.argos.co.uk/search/pokemon-trading-cards/",
    ],
  },
  {
    name: "GAME", base: "https://www.game.co.uk", type: "html",
    urls: [
      "https://www.game.co.uk/search?q=pokemon+booster+box",
      "https://www.game.co.uk/search?q=pokemon+elite+trainer+box",
      "https://www.game.co.uk/search?q=pokemon+ascended+heroes",
      "https://www.game.co.uk/search?q=pokemon+destined+rivals",
    ],
  },
  {
    name: "Amazon UK", base: "https://www.amazon.co.uk", type: "html",
    urls: [
      "https://www.amazon.co.uk/s?k=pokemon+booster+box+scarlet+violet&rh=p_85%3A1",
      "https://www.amazon.co.uk/s?k=pokemon+ascended+heroes&rh=p_85%3A1",
      "https://www.amazon.co.uk/s?k=pokemon+destined+rivals&rh=p_85%3A1",
      "https://www.amazon.co.uk/s?k=pokemon+elite+trainer+box&rh=p_85%3A1",
      "https://www.amazon.co.uk/s?k=pokemon+evolving+skies+booster+box&rh=p_85%3A1",
    ],
  },
];

// Tracks last seen price per product — enables price drop alerts
// key = "RetailerName::product title lowercase"
// value = { price, firstSeen (timestamp) }
const seenPrices = new Map();

// ─── TELEGRAM ─────────────────────────────────────────────────────────────────
async function sendPhoto(imageUrl, caption) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, photo: imageUrl, caption, parse_mode: "HTML" }),
    });
    const d = await res.json();
    if (d.ok) { console.log("    📸 Photo sent!"); return true; }
    console.log("    ⚠️ Photo failed:", d.description);
    return false;
  } catch (e) {
    console.log("    ⚠️ Photo error:", e.message);
    return false;
  }
}

async function sendMessage(text) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "HTML", disable_web_page_preview: false }),
    });
    const d = await res.json();
    if (d.ok) console.log("    📱 Message sent!");
    else console.log("    ❌ Message error:", d.description);
  } catch (e) {
    console.log("    ❌ Message error:", e.message);
  }
}

// ─── BUILD ALERT MESSAGE ──────────────────────────────────────────────────────
function buildAlert(f) {
  const rrp    = getRRP(f.title);
  const market = getMarket(f.title);
  const hold   = getHoldData(f.title);
  const { label, stars } = getDealRating(f.price, rrp, market);
  const t = f.title.toLowerCase();

  // Price deltas
  const vsRrp    = rrp    ? ((f.price - rrp)    / rrp    * 100) : null;
  const vsMarket = market ? ((f.price - market)  / market * 100) : null;
  const saveRrp  = rrp    ? (rrp - f.price)    : null;
  const saveMkt  = market ? (market - f.price)  : null;

  // Flip calculation (eBay UK fees: ~12.8% + £0.30 listing, rounded to 13% + £4 postage)
  const ebayFeeRate = 0.13;
  const postage     = 4.00;
  const flipProfit  = market ? (market - f.price - (market * ebayFeeRate) - postage) : null;
  const flipRoi     = (flipProfit !== null && f.price > 0) ? (flipProfit / f.price * 100) : null;

  // Per-pack cost
  let perPack = null;
  if (t.includes("booster box") && !t.includes("half")) perPack = f.price / 36;
  else if (t.includes("half box") || t.includes("half booster box")) perPack = f.price / 18;
  else if (t.includes("booster bundle")) perPack = f.price / 6;

  // Hold 12-month forecast
  const yr1est = (hold && market) ? (market * hold.yr1mult) : null;

  // Overall verdict
  function buildVerdict() {
    const isFlippable    = flipProfit !== null && flipProfit > 0;
    const isGoodFlip     = flipRoi !== null && flipRoi >= 10;
    const isExceptional  = flipRoi !== null && flipRoi >= 20;
    const isGoodHold     = hold && hold.holdScore >= 6;
    const isBelowMarket  = vsMarket !== null && vsMarket < -5;

    if (isExceptional && isGoodHold)
      return "✅ BUY — Strong flip profit + excellent hold value";
    if (isExceptional)
      return "✅ BUY — Strong flip profit available now";
    if (isGoodFlip && isGoodHold)
      return "✅ BUY — Profitable to flip + good hold";
    if (isGoodFlip)
      return "✅ BUY — Profitable to flip";
    if (isFlippable && isGoodHold)
      return "✅ BUY — Small flip profit + strong hold value";
    if (isFlippable)
      return "⚖️ CONSIDER — Small flip profit, check if worth your time";
    if (isBelowMarket && isGoodHold)
      return "⚖️ CONSIDER — Below market, good hold potential";
    if (isBelowMarket)
      return "⚖️ CONSIDER — Below market price";
    if (flipProfit !== null && flipProfit <= 0)
      return "❌ AVOID — No profit after eBay fees + postage";
    return "❌ AVOID — Not profitable at this price";
  }

  const trendIcon = !hold ? "→" :
    hold.trend === "rising" ? "↗️" :
    hold.trend === "declining" ? "↘️" : "→";

  const fmt = n => n.toFixed(2);
  const pct = n => `${n > 0 ? "+" : ""}${Math.round(n)}%`;
  const sgn = n => `${n >= 0 ? "+" : ""}£${fmt(Math.abs(n))}`;

  const dropLine = f.isPriceDrop
    ? `🔻 Was £${fmt(f.oldPrice)} → Now £${fmt(f.price)} (−£${fmt(f.oldPrice - f.price)} off)`
    : null;

  const lines = [
    `${f.isPriceDrop ? "🔻 PRICE DROP  " : ""}${label} ${stars}`,
    ``,
    ...(dropLine ? [dropLine, ``] : []),
    `<b>${f.title}</b>`,
    `🏪 <b>${f.retailer}</b>`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━`,
    `💰 BUY PRICE:  <b>£${fmt(f.price)}</b>`,
  ];

  if (rrp)    lines.push(`📊 RRP:        £${fmt(rrp)}  (${saveRrp >= 0 ? "-" : "+"}£${fmt(Math.abs(saveRrp))} / <b>${pct(vsRrp)}</b>)`);
  if (market) lines.push(`📈 eBay SOLD:  £${fmt(market)}  (${saveMkt >= 0 ? "save £" : "over by £"}${fmt(Math.abs(saveMkt))} / <b>${pct(vsMarket)}</b>)`);
  if (perPack) lines.push(`🃏 PER PACK:   £${fmt(perPack)}`);

  if (flipProfit !== null) {
    lines.push(``, `━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`💸 <b>FLIP CALCULATOR</b>`);
    lines.push(`   Sell at eBay:  £${fmt(market)}`);
    lines.push(`   eBay fees 13%: -£${fmt(market * ebayFeeRate)}`);
    lines.push(`   Postage:       -£${fmt(postage)}`);
    lines.push(`   ─────────────────────`);
    if (flipProfit > 0) {
      lines.push(`   <b>NET PROFIT: +£${fmt(flipProfit)} (+${Math.round(flipRoi)}% ROI) ✅</b>`);
    } else {
      lines.push(`   <b>NET LOSS: -£${fmt(Math.abs(flipProfit))} (${Math.round(flipRoi)}% ROI) ⚠️</b>`);
    }
  }

  if (hold) {
    lines.push(``, `━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`📦 <b>HOLD ANALYSIS</b>`);
    lines.push(`   Score: ${"⭐".repeat(hold.holdScore >= 8 ? 3 : hold.holdScore >= 6 ? 2 : 1)} ${hold.holdScore}/10`);
    lines.push(`   Trend: ${trendIcon} ${hold.trend.charAt(0).toUpperCase() + hold.trend.slice(1)}`);
    if (yr1est) lines.push(`   12mo est: £${Math.round(yr1est * 0.9)}–£${Math.round(yr1est * 1.1)}`);
    lines.push(`   ${hold.note}`);
  }

  lines.push(``, `━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`🏆 <b>VERDICT: ${buildVerdict()}</b>`);
  lines.push(``, `<a href="${f.url}">👉 BUY NOW →</a>`);

  return lines.join("\n");
}

async function sendAlert(f) {
  const caption = buildAlert(f);

  // Telegram photo captions are capped at 1024 chars — use message if longer
  if (f.image && f.image.startsWith("http") && caption.length <= 1020) {
    const sent = await sendPhoto(f.image, caption);
    if (!sent) await sendMessage(caption);
  } else if (f.image && f.image.startsWith("http")) {
    // Send photo then full stats as a separate message
    const shortCaption = buildShortCaption(f);
    const sent = await sendPhoto(f.image, shortCaption);
    if (sent) await sendMessage(caption);
    else await sendMessage(caption);
  } else {
    await sendMessage(caption);
  }
}

function buildShortCaption(f) {
  const rrp    = getRRP(f.title);
  const market = getMarket(f.title);
  const { label, stars } = getDealRating(f.price, rrp, market);
  const vsMarket = market ? Math.round((f.price - market) / market * 100) : null;
  const vsRrp    = rrp    ? Math.round((f.price - rrp)    / rrp    * 100) : null;
  const fmt = n => n.toFixed(2);
  const lines = [
    `${label} ${stars}`,
    ``,
    `<b>${f.title}</b>`,
    `🏪 <b>${f.retailer}</b>`,
    ``,
    `💰 £${fmt(f.price)}`,
  ];
  if (rrp)    lines.push(`📊 RRP £${fmt(rrp)} (${vsRrp > 0 ? "+" : ""}${vsRrp}%)`);
  if (market) lines.push(`📈 eBay £${fmt(market)} (${vsMarket > 0 ? "+" : ""}${vsMarket}%)`);
  lines.push(``, `<a href="${f.url}">👉 BUY NOW →</a>`);
  return lines.join("\n");
}

// ─── MAIN SCAN ────────────────────────────────────────────────────────────────
async function runScan() {
  console.log(`\n🔍 ${RETAILERS.length} retailers · ${new Date().toLocaleTimeString("en-GB")}`);
  const findings = [];

  for (const retailer of RETAILERS) {
    console.log(`  → ${retailer.name}`);

    if (retailer.type === "shopify-json") {
      const items = await fetchShopifyProducts(retailer.base);
      console.log(`    ${items.length} products fetched`);

      for (const item of items) {
        if (!isValidProduct(item.title, item.price)) continue;
        const key = `${retailer.name}::${item.title.toLowerCase().trim()}`;
        const seen = seenPrices.get(key);
        if (!seen) {
          seenPrices.set(key, { price: item.price, firstSeen: Date.now() });
          findings.push({ ...item, retailer: retailer.name });
          console.log(`    🟢 "${item.title}" £${item.price}`);
        } else if (item.price < seen.price * 0.95) {
          const oldPrice = seen.price;
          seenPrices.set(key, { price: item.price, firstSeen: seen.firstSeen });
          findings.push({ ...item, retailer: retailer.name, isPriceDrop: true, oldPrice });
          console.log(`    🔻 DROP "${item.title}" £${oldPrice} → £${item.price}`);
        }
      }

      await delay(2000 + Math.random() * 1000);
    } else {
      for (const url of (retailer.urls || [])) {
        await delay(2000 + Math.random() * 1500);
        const html = await fetchPage(url);
        if (!html) continue;

        const items = parseShopifyHtml(html, retailer.base);
        const term = url.split("=").pop() || url;
        if (items.length > 0) console.log(`    [${term}] ${items.length} items`);

        for (const item of items) {
          if (!isValidProduct(item.title, item.price)) continue;
          const key = `${retailer.name}::${item.title.toLowerCase().trim()}`;
          const seen = seenPrices.get(key);
          if (!seen) {
            seenPrices.set(key, { price: item.price, firstSeen: Date.now() });
            findings.push({ ...item, retailer: retailer.name });
            console.log(`    🟢 "${item.title}" £${item.price}`);
          } else if (item.price < seen.price * 0.95) {
            const oldPrice = seen.price;
            seenPrices.set(key, { price: item.price, firstSeen: seen.firstSeen });
            findings.push({ ...item, retailer: retailer.name, isPriceDrop: true, oldPrice });
            console.log(`    🔻 DROP "${item.title}" £${oldPrice} → £${item.price}`);
          }
        }
      }
    }
  }

  console.log(`\n📊 ${findings.length} new confirmed deals`);

  for (const f of findings) {
    await sendAlert(f);
    await delay(1200);
  }

  if (findings.length === 0) console.log("  ⬜ Nothing new this scan.");
  return findings.map(f => ({ ...f, store: f.retailer }));
}

// ─── SAVE DEALS TO GITHUB ─────────────────────────────────────────────────────
const GH_TOKEN = process.env.GH_TOKEN;
const GH_REPO = "lock3yv1/lock3ys-den";

async function saveDealsToGitHub(deals) {
  if (!GH_TOKEN) { console.log("⚠️ No GH_TOKEN — skipping deals.json"); return; }
  try {
    let sha;
    try {
      const existing = await fetch(
        `https://api.github.com/repos/${GH_REPO}/contents/deals.json`,
        { headers: { Authorization: `token ${GH_TOKEN}`, "User-Agent": "pokescraper" } }
      );
      if (existing.ok) sha = (await existing.json()).sha;
    } catch {}

    const content = Buffer.from(JSON.stringify(deals, null, 2)).toString("base64");
    const res = await fetch(
      `https://api.github.com/repos/${GH_REPO}/contents/deals.json`,
      {
        method: "PUT",
        headers: { Authorization: `token ${GH_TOKEN}`, "Content-Type": "application/json", "User-Agent": "pokescraper" },
        body: JSON.stringify({ message: `deals update ${new Date().toISOString()}`, content, ...(sha ? { sha } : {}) }),
      }
    );
    if (res.ok) console.log(`✅ Saved ${deals.length} deals to GitHub`);
    else console.log("❌ GitHub save error:", (await res.json()).message);
  } catch (e) {
    console.log("❌ GitHub save error:", e.message);
  }
}

// ─── STARTUP — single run for GitHub Actions ──────────────────────────────────
console.log("🚀 Lock3y's PokéScraper — GitHub Actions");
console.log("🇬🇧 English sealed products only · All expansions");
console.log("📊 Shopify JSON API + HTML fallback · Full deal intelligence\n");

(async () => {
  try {
    const found = await runScan();

    // Save all current in-stock deals to GitHub for the app
    if (found && found.length > 0) {
      await saveDealsToGitHub(found.map(f => ({
        id: `${f.retailer}::${f.title.toLowerCase().trim()}`,
        product: f.title,
        retailer: f.retailer,
        buyNow: f.price,
        rrp: getRRP(f.title),
        resell: getMarket(f.title),
        url: f.url,
        image: f.image || null,
        lastSeen: new Date().toISOString(),
      })));
    }
  } catch (e) {
    console.error("Fatal:", e.message);
    process.exit(1);
  }
  console.log("\n✅ Done.");
  process.exit(0);
})();
