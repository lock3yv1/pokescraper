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
// Updated May 14 2026 — eBay UK completed listings median sold prices
// Source: eBay UK sold, PriceCharting, CardChill, GamesRadar tracking
const MARKET = {
  // ── MEGA EVOLUTION ERA (2026) ──────────────────────────────────────────
  // Ascended Heroes (ME01) — eBay UK boxes £110-140, median ~£125
  "ascended heroes booster box":        125,
  "ascended heroes elite trainer box":   62,
  "ascended heroes etb":                 62,
  "ascended heroes booster bundle":      35,
  "ascended heroes half booster box":    72,
  "ascended heroes half box":            72,
  "ascended heroes booster pack":         7,
  "ascended heroes blister":             14,
  "ascended heroes tin":                 28,

  // Destined Rivals (ME02/SV10) — eBay UK boxes £95-115, median ~£105
  // Half boxes £55-65, ETBs £48-55
  "destined rivals booster box":        105,
  "destined rivals elite trainer box":   52,
  "destined rivals etb":                 52,
  "destined rivals booster bundle":      28,
  "destined rivals half booster box":    60,
  "destined rivals half box":            60,
  "destined rivals booster pack":         5.50,
  "destined rivals blister":             12,
  "destined rivals tin":                 25,

  // Perfect Order (ME03) — eBay UK boxes £115-145, median ~£130
  "perfect order booster box":          130,
  "perfect order elite trainer box":     60,
  "perfect order etb":                   60,
  "perfect order booster bundle":        32,
  "perfect order booster pack":           7.50,
  "perfect order tin":                   26,

  // Chaos Rising (ME04) — released May 22 2026, preorders £120-160
  "chaos rising booster box":           145,
  "chaos rising elite trainer box":      65,
  "chaos rising etb":                    65,
  "chaos rising booster bundle":         35,
  "chaos rising booster pack":            8,
  "chaos rising tin":                    28,

  // Phantasmal Flames (ME05) — announced, ~£150-165 predicted
  "phantasmal flames booster box":      158,
  "phantasmal flames elite trainer box": 75,
  "phantasmal flames etb":               75,
  "phantasmal flames booster pack":       9.50,

  // ── SCARLET & VIOLET ──────────────────────────────────────────────────
  // Journey Together (SV09) — eBay UK £110-120 booster box
  "journey together booster box":       115,
  "journey together elite trainer box":  50,
  "journey together etb":                50,
  "journey together booster bundle":     27,
  "journey together half booster box":   65,
  "journey together half box":           65,
  "journey together booster pack":        5,
  "journey together tin":                22,
  "journey together blister":            11,

  // Prismatic Evolutions (SV08.5) — iconic, ETBs still £85-100, boxes £210-230
  "prismatic evolutions booster box":   220,
  "prismatic evolutions booster bundle": 88,
  "prismatic evolutions elite trainer box": 92,
  "prismatic evolutions etb":            92,
  "prismatic evolutions booster pack":   17,
  "prismatic evolutions blister":        26,
  "prismatic evolutions tin":            34,
  "prismatic evolutions premium collection": 90,

  // Surging Sparks (SV08) — booster boxes £195-235 UK May 2026 (150-250% gains over 18mo)
  "surging sparks booster box":         215,
  "surging sparks elite trainer box":    58,
  "surging sparks etb":                  58,
  "surging sparks booster bundle":       32,
  "surging sparks booster pack":          7,
  "surging sparks tin":                  22,
  "surging sparks blister":              13,

  // Stellar Crown (SV07)
  "stellar crown booster box":          148,
  "stellar crown elite trainer box":     58,
  "stellar crown etb":                   58,
  "stellar crown booster bundle":        30,
  "stellar crown booster pack":           6.50,
  "stellar crown tin":                   19,

  // Shrouded Fable (SV06.5)
  "shrouded fable booster box":          98,
  "shrouded fable booster pack":          4.80,

  // Twilight Masquerade (SV06)
  "twilight masquerade booster box":    118,
  "twilight masquerade elite trainer box": 48,
  "twilight masquerade etb":             48,
  "twilight masquerade booster bundle":  28,
  "twilight masquerade booster pack":     7,
  "twilight masquerade tin":             18,

  // Temporal Forces (SV05)
  "temporal forces booster box":        102,
  "temporal forces elite trainer box":   46,
  "temporal forces etb":                 46,
  "temporal forces half booster box":    58,
  "temporal forces half box":            58,
  "temporal forces booster pack":         5,
  "temporal forces tin":                 17,

  // Paradox Rift (SV04)
  "paradox rift booster box":           108,
  "paradox rift elite trainer box":      48,
  "paradox rift etb":                    48,
  "paradox rift half booster box":       60,
  "paradox rift half box":               60,
  "paradox rift booster pack":            5,
  "paradox rift tin":                    19,

  // Obsidian Flames (SV03)
  "obsidian flames booster box":        118,
  "obsidian flames elite trainer box":   50,
  "obsidian flames etb":                 50,
  "obsidian flames booster bundle":      28,
  "obsidian flames booster pack":        10,
  "obsidian flames tin":                 19,

  // Paldea Evolved (SV02)
  "paldea evolved booster box":          92,
  "paldea evolved booster bundle":       26,
  "paldea evolved elite trainer box":    42,
  "paldea evolved etb":                  42,
  "paldea evolved booster pack":          8,
  "paldea evolved tin":                  15,

  // Paldean Fates (SV04.5) — shiny vault
  "paldean fates booster box":          132,
  "paldean fates booster bundle":        36,
  "paldean fates elite trainer box":     60,
  "paldean fates etb":                   60,
  "paldean fates booster pack":          12,
  "paldean fates tin":                   21,

  // Scarlet & Violet Base (SV01)
  "scarlet violet booster box":          102,
  "scarlet violet elite trainer box":     46,
  "scarlet violet etb":                   46,
  "scarlet violet booster pack":           7,
  "scarlet violet tin":                   17,

  // 151 (SV03.5) — consistently popular
  "151 booster box":                     178,
  "151 booster bundle":                   50,
  "151 elite trainer box":                68,
  "151 etb":                              68,
  "151 booster pack":                      8,
  "151 poster collection":                25,

  // ── SWORD & SHIELD ERA ────────────────────────────────────────────────
  "crown zenith booster box":           128,
  "crown zenith elite trainer box":      60,
  "crown zenith etb":                    60,
  "crown zenith booster pack":           10,
  "crown zenith tin":                    19,

  "silver tempest booster box":         112,
  "silver tempest elite trainer box":    52,
  "silver tempest etb":                  52,
  "silver tempest booster pack":         10,
  "silver tempest tin":                  17,

  "lost origin booster box":            122,
  "lost origin elite trainer box":       50,
  "lost origin etb":                     50,
  "lost origin booster pack":             8.50,

  "astral radiance booster box":        120,
  "astral radiance elite trainer box":   48,
  "astral radiance etb":                 48,
  "astral radiance booster pack":         8,

  "brilliant stars booster box":        142,
  "brilliant stars elite trainer box":   56,
  "brilliant stars etb":                 56,
  "brilliant stars booster pack":        10,
  "brilliant stars tin":                 18,

  "fusion strike booster box":          138,
  "fusion strike elite trainer box":     50,
  "fusion strike etb":                   50,
  "fusion strike booster pack":           9.50,

  // Evolving Skies (SWSH07) — $260-310 USD March 2026 = £205-245 UK median ~£225
  // Umbreon VMAX Alt Art at $1,771 raw, 449% long-term appreciation
  "evolving skies booster box":         225,
  "evolving skies elite trainer box":   172,
  "evolving skies etb":                 172,
  "evolving skies booster pack":         35,
  "evolving skies tin":                  44,
  "evolving skies blister":              27,

  "chilling reign booster box":         152,
  "chilling reign elite trainer box":    60,
  "chilling reign etb":                  60,
  "chilling reign booster pack":         12,
  "chilling reign tin":                  21,

  "battle styles booster box":          172,
  "battle styles elite trainer box":     62,
  "battle styles etb":                   62,
  "battle styles booster pack":          11,
  "battle styles tin":                   21,

  "shining fates booster box":          240,
  "shining fates elite trainer box":    112,
  "shining fates etb":                  112,
  "shining fates booster pack":          16,
  "shining fates tin":                   29,
  "shining fates mini tins":             27,

  "vivid voltage booster box":          142,
  "vivid voltage elite trainer box":     56,
  "vivid voltage etb":                   56,
  "vivid voltage booster pack":          10,
  "vivid voltage tin":                   19,

  "darkness ablaze booster box":        132,
  "darkness ablaze elite trainer box":   52,
  "darkness ablaze etb":                 52,
  "darkness ablaze booster pack":         9.50,
  "darkness ablaze tin":                 17,

  "rebel clash booster box":            122,
  "rebel clash elite trainer box":       48,
  "rebel clash etb":                     48,
  "rebel clash booster pack":             9,

  "sword shield booster box":           195,
  "sword shield booster pack":           10,

  // ── SUN & MOON ERA ───────────────────────────────────────────────────
  "hidden fates booster box":           385,
  "hidden fates elite trainer box":     112,
  "hidden fates etb":                   112,
  "hidden fates booster pack":           14,
  "hidden fates tin":                    44,
  "hidden fates blister":                29,

  "cosmic eclipse booster box":         335,
  "cosmic eclipse booster pack":         12,

  "champions path elite trainer box":   192,
  "champions path etb":                 192,
  "champions path booster pack":         24,

  "unified minds booster box":          242,
  "unified minds booster pack":          10,

  "unbroken bonds booster box":         272,
  "unbroken bonds booster pack":         11,

  // ── TINS ─────────────────────────────────────────────────────────────
  "surging sparks tin":                  22,
  "prismatic evolutions tin":            34,
  "stellar crown tin":                   19,
  "journey together tin":                22,

  // ── PREMIUM COLLECTIONS ─────────────────────────────────────────────
  "prismatic evolutions premium collection": 90,
  "surging sparks premium collection":       36,
  "stellar crown premium collection":        34,
  "obsidian flames premium collection":      30,
  "paradox rift premium collection":         30,
  "evolving skies premium collection":       64,
  "brilliant stars premium collection":      36,
  "shining fates premium collection":        54,
  "hidden fates premium collection":         72,

  // ── BLISTERS ────────────────────────────────────────────────────────
  "prismatic evolutions blister":        26,
  "shining fates blister":               21,
  "hidden fates blister":                29,
  "evolving skies blister":              27,
  "brilliant stars blister":             13,
  "surging sparks blister":              12,
  "journey together blister":            11,

  // ── BUILD & BATTLE ────────────────────────────────────────────────────
  "evolving skies build battle box":     64,
  "chilling reign build battle box":     29,
  "battle styles build battle box":      29,
  "brilliant stars build battle box":    27,
  "surging sparks build battle box":     23,
  "journey together build battle box":   22,
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
  // ── Mega Evolution era (2025-2026) ──
  "ascended heroes", "destined rivals", "perfect order", "chaos rising",
  "phantasmal flames", "mega evolution", "mega lucario", "mega zygarde",
  "nihil zero", "black bolt", "white flare", "first partner",
  // ── Scarlet & Violet ──
  "journey together", "prismatic evolutions", "surging sparks", "stellar crown",
  "shrouded fable", "twilight masquerade", "temporal forces", "paradox rift",
  "obsidian flames", "paldea evolved", "paldean fates",
  "scarlet & violet", "scarlet and violet", "scarlet violet",
  "151", "sv1", "sv2", "sv3", "sv4", "sv5", "sv6", "sv7", "sv8", "sv9",
  // ── Sword & Shield ──
  "crown zenith", "silver tempest", "lost origin", "astral radiance",
  "brilliant stars", "fusion strike", "evolving skies", "chilling reign",
  "battle styles", "shining fates", "vivid voltage", "champions path",
  "darkness ablaze", "rebel clash", "sword & shield", "sword and shield",
  "swsh",
  // ── Sun & Moon ──
  "hidden fates", "cosmic eclipse", "unified minds", "unbroken bonds",
  "team up", "lost thunder", "celestial storm", "forbidden light",
  "ultra prism", "burning shadows", "guardians rising", "sun & moon",
  "sun and moon", "shining legends", "dragon majesty",
  // ── XY era ──
  "evolutions", "steam siege", "fates collide", "breakpoint", "breakthrough",
  "ancient origins", "roaring skies", "primal clash", "phantom forces",
  "flashfire", "kalos starter", "double crisis", "generations",
  "xy base", "xy", "pokemon xy",
  // ── Black & White era ──
  "legendary treasures", "plasma blast", "plasma freeze", "plasma storm",
  "boundaries crossed", "dragons exalted", "dark explorers", "next destinies",
  "noble victories", "emerging powers", "black & white", "black and white",
  "dragon vault",
  // ── HeartGold / SoulSilver era ──
  "call of legends", "triumphant", "undaunted", "unleashed",
  "heartgold soulsilver", "hgss",
  // ── Platinum era ──
  "arceus", "supreme victors", "rising rivals", "platinum base",
  // ── Diamond & Pearl era ──
  "stormfront", "legends awakened", "majestic dawn", "great encounters",
  "secret wonders", "mysterious treasures", "diamond pearl", "dp",
  // ── EX era ──
  "power keepers", "dragon frontiers", "crystal guardians", "holon phantoms",
  "emerald", "unseen forces", "delta species", "deoxys",
  "team rocket returns", "firered leafgreen", "hidden legends",
  "team magma vs team aqua", "ex sandstorm", "ex ruby sapphire", "ex dragon",
  // ── WOTC era (Base Set through Skyridge) ──
  "base set", "jungle", "fossil", "team rocket", "gym heroes", "gym challenge",
  "neo genesis", "neo discovery", "neo revelation", "neo destiny",
  "legendary collection", "expedition", "aquapolis", "skyridge",
  "southern islands",
  // ── Special / seasonal ──
  "celebrations", "pokemon go", "trainers toolkit", "trainer toolkit",
  "league battle deck", "ex league battle deck", "v battle deck",
  "pokemon tcg",
];

// ─── SEALED PRODUCT TYPES ──────────────────────────────────────────────────
// Every real product name pattern used by UK retailers
const PRODUCT_TYPES = [
  // ── Booster Boxes ──
  "booster box", "half booster box", "half box", "display box",
  "booster display",
  // ── Elite Trainer Boxes ──
  "elite trainer box", "etb",
  // ── Booster Bundles & Packs ──
  "booster bundle", "booster pack", "sleeved booster", "sleeve booster",
  "booster packs",
  // ── Blisters ──
  "blister pack", "blister", "blisters",
  "3 pack blister", "3-pack blister", "3pack blister",
  "2 pack blister", "2-pack blister",
  "check lane blister", "check lane",
  // ── Tins ──
  "collector tin", "poke ball tin", "pokeball tin",
  "mini tin", "mini tins",
  "tin",
  // ── Collections & Boxes ──
  "ultra premium collection", "upc",
  "premium collection",
  "special collection",
  "figure collection",
  "collection box",
  "collection chest",
  "collector chest",
  // ── Poster & Sticker products ──
  "poster collection", "poster box", "poster pack",
  "sticker collection", "tech sticker collection", "sticker pack",
  // ── Pin & Accessory Collections ──
  "pin collection", "deluxe pin collection", "pin box",
  "trading card collection",
  // ── V/VSTAR/EX Collections ──
  "v star collection", "vstar collection",
  "v collection", "ex collection",
  "gx collection",
  // ── Collector Kits ──
  "collector's kit", "collectors kit", "collector kit",
  // ── Battle Decks & League Decks ──
  "league battle deck", "v battle deck", "ex battle deck",
  "battle deck",
  // ── Build & Battle ──
  "build and battle box", "build & battle box",
  "build and battle stadium", "build & battle stadium",
  "build and battle", "build & battle",
  // ── Trainer Kits & Starter Sets ──
  "trainer kit", "starter deck", "starter set",
  "premier deck holder",
  // ── Gift & Seasonal ──
  "gift set", "gift box",
  "treasure chest",
  "advent calendar", "holiday calendar",
  // ── Miscellaneous sealed ──
  "booster bundle pack", "booster sleeve",
];

// ─── HARD BLOCK ────────────────────────────────────────────────────────────
const BLOCK = [
  // Non-English languages
  "korean", "japanese", "simplified chinese", "traditional chinese", "chinese",
  "gem pack", "sv3a", "sv4a", "sv5k", "sv6a",
  "glory of team rocket", "ruler of the black flame",
  "ninja spinner", "mega dream ex",
  "terastal", "wild force", "cyber judge", "clay burst",
  // Other card games — must be specific to avoid blocking Pokemon products
  "yu-gi-oh", "yugioh", "magic the gathering", " mtg ", "digimon tcg",
  "one piece card", "dragon ball super card", "disney lorcana", "lorcana",
  "cardfight vanguard", "weiss schwarz", "buddyfight",
  "flesh and blood", "union arena", "grand archive",
  "star wars unlimited", "riftbound",
  // Non-card merchandise
  "funko", "plush", "soft toy", "stuffed",
  "vinyl figure", "action figure", "figurine", "statue",
  "playmat", "neoprene mat",
  "toploader", "penny sleeve", "card sleeve",
  "portfolio binder", "ring binder",
  "dice set", "dice bag",
  "keychain", "lanyard", "pin badge",
  "metal charm", "enamel pin",
  "t-shirt", "hoodie", "cap", "hat",
  "backpack", "lunch box",
  // Graded cards
  "psa graded", "bgs graded", "cgc graded", "beckett graded",
  "psa 10", "psa 9", "bgs 10", "cgc 10",
  // Card lots / singles
  "lot of", "100 cards", "bulk lot", "common lot",
  "holo card", "reverse holo card", "full art card",
  "proxy", "fake", "replica", "custom card",
  // Cases / full displays
  "booster box case", "etb case", "case of 6", "case of 12",
  "sealed case", "display case",
  // Other explicit blocks
  "card lot", "mystery bundle cards", "panini", "topps", "bandai cards",
];

// ─── PRICE SANITY LIMITS PER PRODUCT TYPE ─────────────────────────────────
const PRICE_LIMITS = {
  "booster pack":               { min: 2,   max: 200  },
  "booster box":                { min: 50,  max: 5000 },
  "half box":                   { min: 30,  max: 2500 },
  "half booster box":           { min: 30,  max: 2500 },
  "elite trainer box":          { min: 25,  max: 500  },
  "etb":                        { min: 25,  max: 500  },
  "booster bundle":             { min: 12,  max: 250  },
  "tin":                        { min: 10,  max: 200  },
  "mini tin":                   { min: 6,   max: 60   },
  "collector tin":              { min: 15,  max: 200  },
  "blister":                    { min: 5,   max: 100  },
  "check lane":                 { min: 4,   max: 40   },
  "poster collection":          { min: 12,  max: 150  },
  "poster box":                 { min: 12,  max: 150  },
  "sticker collection":         { min: 8,   max: 80   },
  "tech sticker collection":    { min: 8,   max: 80   },
  "ultra premium collection":   { min: 60,  max: 600  },
  "premium collection":         { min: 20,  max: 300  },
  "special collection":         { min: 20,  max: 300  },
  "figure collection":          { min: 15,  max: 200  },
  "collection box":             { min: 20,  max: 300  },
  "collection chest":           { min: 25,  max: 250  },
  "collector chest":            { min: 25,  max: 250  },
  "pin collection":             { min: 10,  max: 120  },
  "battle deck":                { min: 8,   max: 80   },
  "v battle deck":              { min: 10,  max: 100  },
  "league battle deck":         { min: 15,  max: 150  },
  "build and battle":           { min: 15,  max: 80   },
  "build & battle":             { min: 15,  max: 80   },
  "trainer kit":                { min: 10,  max: 60   },
  "premier deck":               { min: 12,  max: 100  },
  "gift set":                   { min: 20,  max: 250  },
  "gift box":                   { min: 20,  max: 250  },
  "advent":                     { min: 20,  max: 120  },
  "default":                    { min: 5,   max: 1500 },
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
  const blocked = BLOCK.find(k => t.includes(k));
  if (blocked) return false;
  if (!PRODUCT_TYPES.some(k => tn.includes(normaliseTitle(k)))) return false;
  if (!ENGLISH_SETS.some(s => tn.includes(normaliseTitle(s)))) return false;
  const limits = getPriceLimits(title);
  if (price < limits.min || price > limits.max) return false;
  return true;
}

// Debug version — logs why a product fails (use temporarily)
function debugProduct(title, price) {
  const t = title.toLowerCase();
  const tn = normaliseTitle(title);
  const blocked = BLOCK.find(k => t.includes(k));
  if (blocked) return `BLOCKED by "${blocked}"`;
  if (!PRODUCT_TYPES.some(k => tn.includes(normaliseTitle(k)))) return `NO PRODUCT TYPE in: ${tn.slice(0,60)}`;
  if (!ENGLISH_SETS.some(s => tn.includes(normaliseTitle(s)))) return `NO SET MATCH in: ${tn.slice(0,60)}`;
  const limits = getPriceLimits(title);
  if (price < limits.min || price > limits.max) return `PRICE £${price} outside [£${limits.min}-£${limits.max}]`;
  return "VALID";
}

// Higher priority products always shown — packs only if profitable flip
function getProductPriority(title) {
  const t = title.toLowerCase();
  if (t.includes("booster box") && !t.includes("half")) return "HIGH";
  if (t.includes("half booster box") || t.includes("half box")) return "HIGH";
  if (t.includes("elite trainer box") || t.includes("etb")) return "HIGH";
  if (t.includes("booster bundle")) return "HIGH";
  if (t.includes("ultra premium collection") || t.includes("upc")) return "HIGH";
  if (t.includes("tin") || t.includes("collection box")) return "MEDIUM";
  if (t.includes("blister") || t.includes("poster collection")) return "MEDIUM";
  if (t.includes("booster pack")) return "LOW"; // Only send if profitable
  return "MEDIUM";
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
async function fetchShopifyProducts(baseUrl, customCollections) {
  const seen = new Set();
  const items = [];

  // Use retailer-specific collections if provided, otherwise try defaults
  const collectionPaths = customCollections || [
    "/collections/pokemon-tcg",
    "/collections/pokemon-sealed-products",
    "/collections/pokemon-sealed",
    "/collections/pokemon",
    "/collections/all",
    "",  // products.json root
  ];

  const endpoints = collectionPaths.map(path =>
    path ? `${baseUrl}${path}/products.json` : `${baseUrl}/products.json`
  );

  let workingEndpoint = null;
  for (const ep of endpoints) {
    const probe = await fetchJson(`${ep}?limit=1&page=1`);
    if (probe && Array.isArray(probe.products) && probe.products.length > 0) {
      workingEndpoint = ep;
      break;
    }
  }
  if (!workingEndpoint) { console.log(`    No working endpoint found`); return items; }

  for (let page = 1; page <= 5; page++) {
    const url = `${workingEndpoint}?limit=250&page=${page}`;
    const data = await fetchJson(url);
    if (!data || !Array.isArray(data.products) || data.products.length === 0) break;

    for (const product of data.products) {
      const title = product.title;
      if (!title) continue;

      // Only include variants explicitly marked available AND have stock
      const variant = (product.variants || []).find(v =>
        v.available === true &&
        parseFloat(v.price) > 0 &&
        (v.inventory_quantity === undefined || v.inventory_quantity > 0)
      );
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
  {
    name: "Total Cards", base: "https://totalcards.net", type: "shopify-json",
    collections: [
      "/collections/pokemon-scarlet-violet",
      "/collections/pokemon-sword-shield",
      "/collections/pokemon-sun-moon",
      "/collections/pokemon-booster-boxes",
      "/collections/pokemon-elite-trainer-boxes",
      "/collections/pokemon-sealed-product",
      "/collections/pokemon-tcg",
      "/collections/pokemon",
    ],
  },
  { name: "Titan Cards",    base: "https://titancards.co.uk",    type: "shopify-json" },
  {
    name: "Eterna Cards", base: "https://eternacards.co.uk", type: "shopify-json",
    collections: [
      "/collections/pokemon-booster-boxes",
      "/collections/pokemon-elite-trainer-boxes",
      "/collections/pokemon-half-boxes",
      "/collections/pokemon-tcg-sealed-products",
      "/collections/pokemon-sealed",
      "/collections/pokemon",
    ],
  },
  {
    name: "PACKRAT", base: "https://packratt.co.uk", type: "shopify-json",
    collections: [
      "/collections/pokemon-sealed",
      "/collections/pokemon-tcg",
      "/collections/pokemon",
      "/collections/all",
    ],
  },
  { name: "Double Sleeved", base: "https://doublesleeved.co.uk", type: "shopify-json" },
  {
    name: "Toys N Geek", base: "https://www.toysngeek.co.uk", type: "shopify-json",
    collections: ["/collections/pokemon-tcg", "/collections/pokemon-sealed", "/collections/pokemon", "/collections/all"],
  },
  {
    name: "The Card Vault", base: "https://thecardvault.co.uk", type: "shopify-json",
    collections: [
      "/collections/pokemon-sealed-products",
      "/collections/pokemon-booster-boxes",
      "/collections/pokemon-tcg",
      "/collections/pokemon",
      "/collections/all",
    ],
  },
  { name: "My TCG",         base: "https://mytcg.co.uk",         type: "shopify-json" },
  { name: "Gathering Games",base: "https://gatheringgames.co.uk",type: "shopify-json" },
  { name: "Magic Madhouse", base: "https://magicmadhouse.co.uk", type: "shopify-json",
    collections: [
      "/collections/pokemon-sealed",
      "/collections/pokemon-tcg",
      "/collections/pokemon",
      "/collections/all",
    ],
  },
  {
    name: "Japan2UK", base: "https://japan2uk.com", type: "shopify-json",
    collections: [
      "/collections/pokemon-english-sealed",
      "/collections/english-sealed",
      "/collections/pokemon-tcg-english",
      "/collections/pokemon-sealed-english",
      "/collections/pokemon-sealed",
      "/collections/pokemon-english",
      "/collections/pokemon-tcg",
    ],
  },
  {
    name: "Smyths", base: "https://www.smythstoys.com", type: "html",
    urls: [
      "https://www.smythstoys.com/uk/en-gb/search/?text=pokemon+booster+box",
      "https://www.smythstoys.com/uk/en-gb/search/?text=pokemon+elite+trainer+box",
      "https://www.smythstoys.com/uk/en-gb/search/?text=pokemon+tin",
      "https://www.smythstoys.com/uk/en-gb/search/?text=pokemon+collection+box",
      "https://www.smythstoys.com/uk/en-gb/search/?text=pokemon+booster+bundle",
      "https://www.smythstoys.com/uk/en-gb/search/?text=pokemon+ascended+heroes",
      "https://www.smythstoys.com/uk/en-gb/search/?text=pokemon+destined+rivals",
      "https://www.smythstoys.com/uk/en-gb/search/?text=pokemon+surging+sparks",
      "https://www.smythstoys.com/uk/en-gb/search/?text=pokemon+prismatic+evolutions",
    ],
  },
  {
    name: "Amazon UK", base: "https://www.amazon.co.uk", type: "html",
    urls: [
      "https://www.amazon.co.uk/s?k=pokemon+booster+box+english&rh=p_85%3A1",
      "https://www.amazon.co.uk/s?k=pokemon+elite+trainer+box+english&rh=p_85%3A1",
      "https://www.amazon.co.uk/s?k=pokemon+ascended+heroes&rh=p_85%3A1",
      "https://www.amazon.co.uk/s?k=pokemon+destined+rivals&rh=p_85%3A1",
    ],
  },
  // New UK retailers
  {
    name: "Big Orbit Cards", base: "https://www.bigorbitcards.co.uk", type: "shopify-json",
    collections: [
      "/collections/pokemon-sealed-products",
      "/collections/pokemon-booster-boxes",
      "/collections/pokemon",
    ],
  },
  {
    name: "Zatu Games", base: "https://www.board-game.co.uk", type: "shopify-json",
    collections: [
      "/collections/pokemon-tcg",
      "/collections/pokemon-sealed",
      "/collections/pokemon",
    ],
  },
  {
    name: "Pokemon Center UK", base: "https://www.pokemoncenter.com", type: "html",
    urls: [
      "https://www.pokemoncenter.com/en-gb/category/booster-boxes",
      "https://www.pokemoncenter.com/en-gb/category/elite-trainer-boxes",
      "https://www.pokemoncenter.com/en-gb/category/booster-packs",
      "https://www.pokemoncenter.com/en-gb/category/tins",
      "https://www.pokemoncenter.com/en-gb/category/collections",
      "https://www.pokemoncenter.com/en-gb/category/booster-bundles",
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

  const vsMarket = (market > 0) ? ((f.price - market) / market * 100) : null;
  const vsRrp    = (rrp > 0)    ? ((f.price - rrp)    / rrp    * 100) : null;
  const ebayFee  = market ? +(market * 0.13).toFixed(2) : null;
  const postage  = 4.00;
  const flipNet  = market ? +(market - f.price - ebayFee - postage).toFixed(2) : null;
  const flipRoi  = (flipNet !== null && f.price > 0) ? Math.round(flipNet / f.price * 100) : null;

  let perPack = null;
  if (t.includes("booster box") && !t.includes("half")) perPack = +(f.price / 36).toFixed(2);
  else if (t.includes("half")) perPack = +(f.price / 18).toFixed(2);
  else if (t.includes("booster bundle")) perPack = +(f.price / 6).toFixed(2);

  const p = n => n != null ? `£${(+n).toFixed(2)}` : "—";
  const pct = n => n != null ? `${n > 0 ? "+" : ""}${Math.round(n)}%` : "";

  // ── VERDICT ── the single most important line ──────────────────────────────
  function verdict() {
    if (flipNet !== null) {
      if (flipRoi >= 25) return `🔥 STRONG BUY — ${flipRoi}% ROI, flip for +${p(flipNet)} profit`;
      if (flipRoi >= 15) return `✅ BUY — Solid flip: +${p(flipNet)} profit (${flipRoi}% ROI)`;
      if (flipRoi >= 8)  return `✅ BUY — Profitable flip: +${p(flipNet)} after fees`;
      if (flipRoi >= 2)  return `⚖️ MARGINAL — Tiny flip profit: +${p(flipNet)}. Buy to keep only`;
      if (flipRoi >= -5) return `⚠️ SLIGHT LOSS — −${p(Math.abs(flipNet))} if flipped. Hold potential only`;
      return                    `❌ AVOID — Flip loss of ${p(Math.abs(flipNet))} after eBay fees`;
    }
    if (vsRrp !== null) {
      if (vsRrp <= -20) return `✅ BUY — ${Math.abs(Math.round(vsRrp))}% below RRP, strong value`;
      if (vsRrp <=   0) return `⚖️ CONSIDER — At or below RRP`;
      if (vsRrp <=  30) return `⚠️ ABOVE RRP — Check eBay before buying`;
      return                   `❌ AVOID — Significantly above RRP`;
    }
    return `📦 IN STOCK — No eBay data available`;
  }

  const lines = [];

  // ── HEADER ──
  if (f.isPriceDrop && f.oldPrice) {
    lines.push(`🔻 PRICE DROP  Was ${p(f.oldPrice)} → Now ${p(f.price)}`);
  }
  lines.push(`${label}  ${stars}`);
  lines.push(``);
  lines.push(`<b>${f.title}</b>`);
  lines.push(`🏪 ${f.retailer}`);
  lines.push(``);

  // ── PRICE COMPARISON ──
  lines.push(`💰 Buy Now:   <b>${p(f.price)}</b>`);
  if (rrp)    lines.push(`📊 RRP:       ${p(rrp)}   ${vsRrp != null ? `(${pct(vsRrp)})` : ""}`);
  if (market) lines.push(`📈 eBay Sold: ${p(market)}  ${vsMarket != null ? `(${pct(vsMarket)})` : ""}`);
  if (perPack) lines.push(`🃏 Per pack:  ${p(perPack)}`);

  // ── FLIP CALCULATOR ──
  if (flipNet !== null) {
    lines.push(``);
    lines.push(flipNet >= 0
      ? `💸 Flip:  <b>+${p(flipNet)} profit  (${flipRoi}% ROI) ✅</b>`
      : `💸 Flip:  <b>−${p(Math.abs(flipNet))} loss  (${flipRoi}% ROI) ❌</b>`
    );
    lines.push(`   Sell ${p(market)} − eBay ${p(ebayFee)} − post ${p(postage)}`);
  }

  // ── HOLD ANALYSIS ──
  if (hold) {
    const yr1 = market ? market * hold.yr1mult : null;
    const trend = hold.trend === "rising" ? "↗️" : hold.trend === "declining" ? "↘️" : "→";
    lines.push(``);
    lines.push(`📦 Hold: ${trend} ${hold.trend}  ·  Score ${hold.holdScore}/10`);
    if (yr1) lines.push(`   Est. 12mo: ${p(Math.round(yr1 * 0.9))}–${p(Math.round(yr1 * 1.1))}`);
    lines.push(`   ${hold.note}`);
  }

  // ── VERDICT — bold, unmissable ──
  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━`);
  lines.push(`🏆 <b>${verdict()}</b>`);
  lines.push(`━━━━━━━━━━━━━━━━━━`);
  lines.push(`<a href="${f.url}">👉 BUY NOW →</a>`);

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
      const items = await fetchShopifyProducts(retailer.base, retailer.collections);
      console.log(`    ${items.length} products fetched`);

      let debugCount = 0;
      for (const item of items) {
        if (!isValidProduct(item.title, item.price)) {
          if (debugCount < 3) {
            console.log(`    ❌ ${debugProduct(item.title, item.price)}: "${item.title}" £${item.price}`);
            debugCount++;
          }
          continue;
        }

        // Show ALL valid products — verdict in the message tells user if worth buying
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

          // Show ALL valid products — verdict tells user if worth buying
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
