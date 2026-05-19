#!/usr/bin/env node
// ShinyDen PokéScraper — GitHub Actions
// Scrapes UK retailers + enriches with eBay Browse API market prices
// Writes deals.json + ebay_deals.json to lock3ys-den repo

const https = require("https");
const http  = require("http");

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const EF = 0.129;  // eBay final value fee 12.9%
const FEE_FIXED = 0.30; // eBay 30p fixed per transaction
const POST = 4;      // avg postage £4

const GH_TOKEN   = process.env.GH_TOKEN;
const GH_REPO    = "lock3yv1/lock3ys-den";
const TELE_TOKEN = process.env.TELEGRAM_TOKEN;
const TELE_CHAT  = process.env.TELEGRAM_CHAT_ID;

const EBAY_CLIENT_ID     = process.env.EBAY_CLIENT_ID;
const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;
const EBAY_SANDBOX       = process.env.EBAY_SANDBOX === "true";

const EBAY_AUTH_URL   = EBAY_SANDBOX
  ? "https://api.sandbox.ebay.com/identity/v1/oauth2/token"
  : "https://api.ebay.com/identity/v1/oauth2/token";
const EBAY_BROWSE_URL = EBAY_SANDBOX
  ? "https://api.sandbox.ebay.com/buy/browse/v1"
  : "https://api.ebay.com/buy/browse/v1";

// ─── FETCH HELPER ─────────────────────────────────────────────────────────────
function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.request(url, {
      method: options.method || "GET",
      headers: options.headers || {},
      timeout: options.timeout || 15000,
    }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => resolve({ ok: res.statusCode < 400, status: res.statusCode, text: () => data, json: () => JSON.parse(data) }));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

const fetch = fetchUrl;
const delay = ms => new Promise(r => setTimeout(r, ms));

// ─── ENGLISH SETS ──────────────────────────────────────────────────────────────
const ENGLISH_SETS = [
  // Mega Evolution era (2025-2026)
  "ascended heroes","destined rivals","perfect order","chaos rising",
  "phantasmal flames","mega evolution","mega lucario",
  "black bolt","white flare","first partner",
  // Scarlet & Violet
  "journey together","prismatic evolutions","surging sparks","stellar crown",
  "shrouded fable","twilight masquerade","temporal forces","paradox rift",
  "obsidian flames","paldea evolved","paldean fates",
  "scarlet & violet","scarlet and violet","scarlet violet",
  "151","sv1","sv2","sv3","sv4","sv5","sv6","sv7","sv8","sv9",
  // Sword & Shield
  "crown zenith","silver tempest","lost origin","astral radiance",
  "brilliant stars","fusion strike","evolving skies","chilling reign",
  "battle styles","shining fates","vivid voltage","champions path",
  "darkness ablaze","rebel clash","sword & shield","sword and shield","swsh",
  // Sun & Moon
  "hidden fates","cosmic eclipse","unified minds","unbroken bonds",
  "team up","lost thunder","celestial storm","forbidden light",
  "ultra prism","burning shadows","guardians rising","sun & moon",
  "sun and moon","shining legends","dragon majesty",
  // XY era
  "evolutions","steam siege","fates collide","breakpoint","breakthrough",
  "ancient origins","roaring skies","primal clash","phantom forces",
  "flashfire","xy base","xy",
  // Classic
  "base set","jungle","fossil","team rocket","gym heroes","gym challenge",
  "neo genesis","neo discovery","neo revelation","neo destiny",
  "legendary collection","expedition","aquapolis","skyridge",
  "ex ruby sapphire","ex sandstorm","ex dragon","ex team magma",
  "ex firered leafgreen","ex deoxys","ex emerald","ex unseen forces",
  "ex delta species","ex legend maker","ex holon phantoms","ex crystal guardians",
  "ex dragon frontiers","ex power keepers",
  "pokemon go","celebrations","crown zenith","battle academy",
];

// ─── BLOCKED TERMS ─────────────────────────────────────────────────────────────
const BLOCK = [
  // Digital codes — worthless for sealed product flipping
  "online code","tcg online","tcg live","pokemon live","code card",
  "digital code","online card","tcg code","digital only","code only",
  "unused code","redeem","redemption code","promo code",
  // Fake/unofficial only — language not blocked (non-English OK if good deal)
  "[jp]","[kr]","[cn]",
  "proxy","custom card","fake card","replica","unofficial","fanmade","fan made",
  // Japanese set codes that sneak through
  "sv1m","sv2m","sv3m","sv4m","sv5m","sv6m","sv7m","sv8m",
  "sv1a","sv2a","sv3a","sv4a","sv5a",
  "sv1s","sv2s","sv3s","sv4s","sv5s","sv6s","sv7s","sv8s",
  "cyber judge","future flash","wild force","clay burst","snow hazard",
  "violet ex","scarlet ex","triplet beat","ruler of the black flame",
  "raging surf","ex start deck","pokemon card 151","mask of change",
  "night wanderer","stellar miracle","paradise dragona","super electric breaker",
  "ancient roar","future flash","lost abyss"," s5 "," s6 "," s7 "," s8 "," s9 ",
  // Non-sealed / accessories
  "energy card","trainer card","supporter card","item card","tool card",
  "lot","bundle of cards","card lot",
  "mystery bundle cards","panini","topps","bandai cards",
  // Non-product items
  "empty box","empty tin","display only","box only","no cards",
  "graded slab","psa ","psa1","psa2","psa3","psa4","psa5","psa6","psa7","psa8","psa9","psa10",
  "bgs ","cgc ","jumbo coin","coin only","puzzle","lunch box",
  "plush","figure","figurine","sleeves","deckbox","deck box",
  "binder","playmat","pin badge","pin collection",
  // Condition indicators (individual cards being sold)
  "near mint","lightly played","moderately played","heavily played",
  "light play","near-mint","nm/m"," nm "," lp "," mp "," hp ",
  "1st edition","shadowless","unlimited edition",
  "reverse holo","holo rare","full art","alt art","special art",
  "common near","uncommon near","rare near","uncommon reverse",
  "0% vat gvms","20% vat","gvms","slightly damaged",
  "vinyl figure","plush","funko","statue","figure",
  "sleeves","deck box","playmat","binder","portfolio",
  "lorcana","magic the gathering","mtg","yugioh","yu-gi-oh","digimon",
  "dragon ball","one piece","flesh and blood","force of will",
  "obsidia-tcg","obsidia tcg",
];

// ─── MARKET TABLE (May 2026 eBay UK prices) ────────────────────────────────────
const MARKET = {
  // ── All prices = verified eBay UK sold median, May 2026 ──────────────────────
  // Mega Evolution era (2025-2026)
  "ascended heroes booster box":           105,  // ME2.5
  "ascended heroes elite trainer box":     135,
  "ascended heroes booster pack":           10,
  "phantasmal flames booster box":         340,
  "phantasmal flames elite trainer box":   105,
  "perfect order booster pack":              7,
  "perfect order booster box":             115,
  "perfect order elite trainer box":        67,  // workflow log: £67 n=11 HIGH
  "chaos rising booster box":              115,
  "chaos rising booster pack":               6,
  "destined rivals booster box":           155,
  "destined rivals elite trainer box":     148,  // new May 2026
  "destined rivals booster bundle":         28,
  "destined rivals booster pack":            8,
  // Japanese/Korean (verified May 2026 from workflow log)
  "nihil zero booster box":                 55,  // Japanese
  "nihil zero korean booster box":          60,  // workflow: £59.99 n=1
  "heatwave arena booster box":            110,  // Japanese
  "heatwave arena korean booster box":      64,  // workflow: £64.30 n=2
  "battle partners booster box":            72,  // Japanese: workflow £71.74 n=10 HIGH
  "battle partners korean booster box":     44,
  "terastal festival booster box":         100,  // Japanese: workflow £100.41 n=12 HIGH
  "terastal festival korean booster box":   80,  // workflow: £80.52 n=10 HIGH
  "white flare booster box":               149,  // Japanese: workflow £148.56 n=9 HIGH
  "white flare korean booster box":         74,  // workflow: £74.04 n=6 MEDIUM
  "black bolt booster box":                 80,  // Japanese: workflow £81.38 n=6 MEDIUM
  "black bolt korean booster box":          63,  // workflow: £63.37 n=10 HIGH
  "glory of team rocket booster box":      170,  // Japanese
  "glory of team rocket korean booster box": 60, // workflow: £60.16 n=5 MEDIUM
  "glory of team rocket booster pack":       6,
  "space juggler booster box":              91,  // workflow: £91.05 n=4
  // Scarlet & Violet (May 2026 prices)
  "surging sparks booster box":            235,
  "surging sparks elite trainer box":       68,  // workflow: £7.70/pack implies ~£68 ETB
  "surging sparks booster pack":             8,
  "stellar crown booster box":             130,
  "stellar crown elite trainer box":        45,
  "stellar crown booster pack":             11,  // workflow: £11.87 n=1
  "twilight masquerade booster box":       145,
  "twilight masquerade elite trainer box":  48,
  "twilight masquerade booster pack":       10,  // workflow: £9.95 n=1
  "temporal forces booster box":           100,
  "temporal forces elite trainer box":      45,
  "temporal forces booster pack":            5,
  "paradox rift booster box":              130,
  "paradox rift elite trainer box":         45,
  "paradox rift half booster box":         123,  // workflow: £123.35 n=8 HIGH
  "paradox rift booster pack":               5,
  "obsidian flames booster box":           210,
  "obsidian flames elite trainer box":      50,
  "obsidian flames booster pack":           10,
  "paldea evolved booster box":            135,
  "paldea evolved elite trainer box":       42,
  "paldea evolved booster pack":             8,
  "paldean fates elite trainer box":        68,
  "paldean fates booster box":             115,
  "scarlet & violet booster box":          125,
  "scarlet & violet elite trainer box":     40,
  "151 booster box":                       195,
  "151 elite trainer box":                  65,
  "151 booster bundle":                     48,
  "151 booster pack":                        8,
  "shrouded fable elite trainer box":       98,
  "shrouded fable booster pack":             8,
  "journey together booster box":          160,
  "journey together elite trainer box":    115,  // workflow: £6.37/pack → ~£115 ETB
  "journey together half booster box":     102,  // workflow: £102.58 n=14 HIGH
  "journey together booster bundle":        43,  // workflow: £43.47 n=12 HIGH
  "journey together booster pack":           6,  // workflow: £6.37 n=2
  "prismatic evolutions elite trainer box": 145,
  "prismatic evolutions booster bundle":    58,
  "prismatic evolutions booster pack":      13,
  // Sword & Shield (corrected May 2026)
  "crown zenith booster box":              300,
  "crown zenith elite trainer box":        105,
  "silver tempest booster box":            145,  // NOT £420 - that retailer was insane
  "silver tempest elite trainer box":      100,
  "silver tempest booster pack":            10,
  "lost origin booster box":               180,
  "lost origin elite trainer box":          88,
  "astral radiance booster box":           175,
  "astral radiance elite trainer box":      95,
  "astral radiance booster pack":            8,
  "brilliant stars booster box":           210,
  "brilliant stars elite trainer box":      78,  // workflow: £78.18 n=4 MEDIUM (NOT £148)
  "brilliant stars booster pack":           10,
  "fusion strike booster box":             200,
  "fusion strike elite trainer box":        88,
  "evolving skies booster box":            215,
  "evolving skies elite trainer box":      148,
  "evolving skies booster pack":            14,
  "chilling reign booster box":            235,
  "chilling reign elite trainer box":      108,
  "chilling reign booster pack":            12,
  "battle styles booster box":             270,
  "battle styles elite trainer box":       125,
  "battle styles booster pack":             10,
  "shining fates elite trainer box":       118,
  "shining fates booster pack":             15,
  "vivid voltage booster box":             185,
  "vivid voltage elite trainer box":        62,
  "vivid voltage booster pack":             10,
  "champions path elite trainer box":      265,
  "champions path booster pack":            24,
  "darkness ablaze booster box":           165,
  "darkness ablaze elite trainer box":      62,
  "darkness ablaze booster pack":           10,
  "rebel clash booster box":               160,
  "rebel clash elite trainer box":          55,
  "rebel clash booster pack":              10,
  "sword & shield booster box":            155,
  "sword & shield booster pack":            10,
  // Sun & Moon
  "hidden fates elite trainer box":        175,
  "hidden fates booster pack":              14,
  "cosmic eclipse booster box":            270,
  "unbroken bonds booster box":            185,
  "team up booster box":                   155,
  "unified minds booster box":             170,
  // Other
  "celebrations elite trainer box":         85,
  "pokemon go elite trainer box":           60,
  "pokemon go booster pack":                7,
  // Chinese
  "collect 151 journey booster box":       101,  // workflow: £101.21 n=5
  "collect 151 hope booster box":           87,  // workflow: £87.18 n=4
};

function getMarket(title) {
  const t = title.toLowerCase().replace(/[|\-]/g, " ").replace(/\s+/g, " ").trim();
  const isBox = t.includes("booster box") || t.includes("display box");
  const isHalf = t.includes("half") || t.includes("18 pack");
  const entries = Object.entries(MARKET).sort((a,b) => b[0].length - a[0].length);
  for (const [k, v] of entries) {
    if (isBox && !isHalf && k.includes("booster pack") && !k.includes("booster box")) continue;
    if (t.includes(k)) return v;
  }
  return null;
}

// ─── RRP TABLE ─────────────────────────────────────────────────────────────────
const RRP = {
  "elite trainer box": 49.99, "etb": 49.99,
  "booster box": 134.99, "half booster box": 69.99,
  "booster bundle": 34.99,
  "booster pack": 4.99,
  "tin": 24.99, "mini tin": 14.99,
  "collection box": 39.99, "premium collection": 39.99,
  "ultra premium collection": 119.99, "upc": 119.99,
  "league battle deck": 34.99, "battle deck": 19.99,
};

function getRRP(title) {
  const t = title.toLowerCase();
  if (t.includes("ultra premium") || t.includes("upc")) return RRP["ultra premium collection"];
  if (t.includes("half booster") || t.includes("half box")) return RRP["half booster box"];
  if (t.includes("booster box")) return RRP["booster box"];
  if (t.includes("elite trainer") || t.includes("etb")) return RRP["elite trainer box"];
  if (t.includes("booster bundle")) return RRP["booster bundle"];
  if (t.includes("booster pack")) return RRP["booster pack"];
  if (t.includes("mini tin")) return RRP["mini tin"];
  if (t.includes("tin")) return RRP["tin"];
  if (t.includes("premium collection")) return RRP["premium collection"];
  if (t.includes("collection")) return RRP["collection box"];
  if (t.includes("league battle deck")) return RRP["league battle deck"];
  if (t.includes("battle deck")) return RRP["battle deck"];
  return null;
}

// ─── HOLD DATA (CRITICAL: must use score/yr1/yr2/yr3/yr4 fields) ───────────────
// These feed calcHold() in the frontend which expects these exact field names
const HOLD_DATA = {
  "evolving skies":       { score:10, trend:"rising",   yr1:1.05, yr2:1.15, yr3:1.35, yr4:1.55, note:"Umbreon VMAX Alt Art (raw ~£300-400+, PSA 10 ~£600+). Generational set — rarer every year." },
  "hidden fates":         { score:9,  trend:"rising",   yr1:1.05, yr2:1.12, yr3:1.25, yr4:1.40, note:"Shiny Charizard GX (raw ~£100-150+, PSA 10 ~£400+). Tiny print run, never reprinted." },
  "prismatic evolutions": { score:9,  trend:"rising",   yr1:1.04, yr2:1.12, yr3:1.28, yr4:1.45, note:"Umbreon ex SIR (raw ~£150-200+, PSA 10 ~£400+). Eevee demand permanent — next Evolving Skies." },
  "shining fates":        { score:8,  trend:"rising",   yr1:1.03, yr2:1.10, yr3:1.20, yr4:1.35, note:"Shiny Charizard VMAX (raw ~£80-120+, PSA 10 ~£300+). Mini Shiny Vault. Print run ended." },
  "champions path":       { score:9,  trend:"rising",   yr1:1.06, yr2:1.15, yr3:1.30, yr4:1.50, note:"Shiny Charizard V (raw ~£60-80+, PSA 10 ~£200+). Tiny print run, supply near exhausted." },
  "brilliant stars":      { score:5,  trend:"stable",   yr1:1.01, yr2:1.03, yr3:1.07, yr4:1.12, note:"Charizard VSTAR (raw ~£40-80, PSA 10 ~£150+). Consistent collector and competitive demand." },
  "chilling reign":       { score:7,  trend:"rising",   yr1:1.04, yr2:1.10, yr3:1.20, yr4:1.35, note:"Shadow Rider Calyrex VMAX (raw ~£40-60+), Ice Rider Alt Art (raw ~£60-80+). Undervalued." },
  "battle styles":        { score:5,  trend:"stable",   yr1:1.01, yr2:1.03, yr3:1.07, yr4:1.11, note:"Urshifu V SWSH-Black Star (raw ~£8-20, PSA 10 ~£60+). Solid competitive and collector floor." },
  "fusion strike":        { score:4,  trend:"stable",   yr1:1.01, yr2:1.02, yr3:1.05, yr4:1.08, note:"Gengar VMAX Alt Art (raw ~£60-80+, PSA 10 ~£150+). Large print run limits ceiling." },
  "astral radiance":      { score:5,  trend:"stable",   yr1:1.02, yr2:1.04, yr3:1.08, yr4:1.12, note:"Origin Forme Palkia VSTAR (raw ~£25-50). Steady appreciation expected." },
  "lost origin":          { score:6,  trend:"rising",   yr1:1.03, yr2:1.08, yr3:1.15, yr4:1.25, note:"Giratina VSTAR (raw ~£40-80, PSA 10 ~£120+). Increasingly popular collector target." },
  "silver tempest":       { score:5,  trend:"stable",   yr1:1.02, yr2:1.04, yr3:1.08, yr4:1.14, note:"Regidrago VSTAR (raw ~£25-50). Modest but steady appreciation." },
  "crown zenith":         { score:6,  trend:"rising",   yr1:1.03, yr2:1.08, yr3:1.16, yr4:1.28, note:"Galarian Gallery exclusives (raw ~£15-80 each). Strong collector appeal." },
  "surging sparks":       { score:8,  trend:"rising",   yr1:1.08, yr2:1.20, yr3:1.40, yr4:1.65, note:"Pikachu ex SIR (raw ~£200-250+, PSA 10 ~£500+). Box prices up 150%+ in 18 months." },
  "151":                  { score:7,  trend:"rising",   yr1:1.05, yr2:1.12, yr3:1.25, yr4:1.40, note:"Charizard ex SIR (raw ~£80-100+), Mew ex SIR (raw ~£40-60+). Permanent nostalgia demand." },
  "destined rivals":      { score:5,  trend:"stable",   yr1:1.04, yr2:1.10, yr3:1.18, yr4:1.28, note:"New set — chase cards TBC. Early buy window. Buy sealed and watch." },
  "temporal forces":      { score:5,  trend:"stable",   yr1:1.02, yr2:1.05, yr3:1.10, yr4:1.15, note:"Walking Wake ex, Iron Leaves ex. Moderate collector interest." },
  "paradox rift":         { score:5,  trend:"stable",   yr1:1.02, yr2:1.05, yr3:1.10, yr4:1.15, note:"Roaring Moon ex, Iron Valiant ex. Steady demand." },
  "paldean fates":        { score:6,  trend:"rising",   yr1:1.04, yr2:1.10, yr3:1.20, yr4:1.32, note:"Shiny Vault mini-set. Shiny Charizard ex (raw ~£60-80+). Limited supply." },
  "obsidian flames":      { score:5,  trend:"stable",   yr1:1.02, yr2:1.05, yr3:1.09, yr4:1.14, note:"Charizard ex SIR Tera (raw ~£50-100+). Popular Charizard variant." },
  "stellar crown":        { score:4,  trend:"stable",   yr1:1.01, yr2:1.03, yr3:1.06, yr4:1.10, note:"Terapagos ex SIR (raw ~£30-40+). Modest appreciation expected." },
  "journey together":     { score:4,  trend:"stable",   yr1:1.02, yr2:1.05, yr3:1.08, yr4:1.12, note:"New 2025 set. Chase cards developing — watch for key pulls." },
  "cosmic eclipse":       { score:7,  trend:"rising",   yr1:1.04, yr2:1.10, yr3:1.22, yr4:1.38, note:"Arceus & Dialga TAG TEAM GX (raw ~£40-60+). Last Sun & Moon premium." },
  "vivid voltage":        { score:5,  trend:"stable",   yr1:1.01, yr2:1.03, yr3:1.06, yr4:1.10, note:"Amazing Rares (raw ~£10-30 each). Moderate collector appeal." },
  "darkness ablaze":      { score:4,  trend:"stable",   yr1:1.01, yr2:1.02, yr3:1.05, yr4:1.08, note:"Charizard VMAX (raw ~£30-50, PSA 10 ~£100+). Fan favourite consistent floor." },
  "rebel clash":          { score:4,  trend:"stable",   yr1:1.01, yr2:1.02, yr3:1.05, yr4:1.08, note:"Inteleon VMAX (raw ~£10-20). Modest set with limited collector ceiling." },
  "ascended heroes":      { score:8,  trend:"rising",   yr1:1.08, yr2:1.18, yr3:1.35, yr4:1.55, note:"Mega Evolution set. Mega Charizard ex (sealed UPC ~£150+). Growing demand." },
  "phantasmal flames":    { score:7,  trend:"rising",   yr1:1.06, yr2:1.14, yr3:1.28, yr4:1.45, note:"Mega Evolution set. Mega Charizard variants drive collector demand." },
  "perfect order":        { score:6,  trend:"rising",   yr1:1.04, yr2:1.10, yr3:1.20, yr4:1.32, note:"Mega Evolution set. Collector demand growing as series matures." },
  "hidden fates":         { score:9,  trend:"rising",   yr1:1.05, yr2:1.12, yr3:1.25, yr4:1.40, note:"Shiny Vault. All Shiny Pokemon — Shiny Charizard GX centrepiece." },
};

function getHoldData(title) {
  const t = title.toLowerCase();
  for (const [k, v] of Object.entries(HOLD_DATA)) {
    if (t.includes(k)) return v;
  }
  return null;
}

// ─── PRODUCT TYPE DETECTION ────────────────────────────────────────────────────
function getPtype(title) {
  const t = title.toLowerCase();
  if (t.includes("ultra premium") || t.includes("upc")) return "Ultra Premium";
  if (t.includes("super premium")) return "Super Premium";
  if (t.includes("half booster") || t.includes("half box")) return "Half Box";
  if (t.includes("booster box")) return "Booster Box";
  if (t.includes("elite trainer") || t.includes("etb")) return "ETB";
  if (t.includes("booster bundle")) return "Booster Bundle";
  if (t.includes("premium collection")) return "Premium Collection";
  if (t.includes("collection box") || t.includes("special collection")) return "Collection Box";
  if (t.includes("booster pack") || t.includes("single booster")) return "Booster Pack";
  if (t.includes("blister")) return "Blister";
  if (t.includes("mini tin")) return "Mini Tin";
  if (t.includes("display case")) return "Display Case";
  // Word boundary prevents "Victini", "Argentina" etc matching as Tin
  if (/\btin\b/.test(t)) return "Tin";
  if (t.includes("league battle deck") || t.includes("battle deck")) return "Battle Deck";
  if (t.includes("starter deck")) return "Starter Deck";
  return null;
}

// ─── TITLE VALIDATION ──────────────────────────────────────────────────────────
function normaliseTitle(t) {
  return t.toLowerCase()
    .replace(/scarlet\s*[&and]+\s*violet\s*/gi, "")
    .replace(/sword\s*[&and]+\s*shield\s*/gi, "")
    .replace(/sun\s*[&and]+\s*moon\s*/gi, "")
    .replace(/pokémon|pokemon/gi, "")
    .replace(/tcg\s*/gi, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ").trim();
}

function isValidProduct(title, price) {
  const t = title.toLowerCase();
  const blocked = BLOCK.find(k => t.includes(k));
  if (blocked) return false;
  // Block individual cards (053/198, 271/SV-P, SWSH001 promo codes)
  if (/\b\d{1,3}\/\d{2,3}\b/.test(t)) return false;
  if (/\b\d{1,3}\/[a-z]{1,6}[-]?[a-z0-9]*\b/i.test(t)) return false;
  // Must be Pokemon
  if (!t.includes("pokemon") && !t.includes("pokémon") && !t.includes("pok")) return false;
  // Must have a valid set
  const hasSet = ENGLISH_SETS.some(s => t.includes(s));
  if (!hasSet) return false;

  // Language filter: if title explicitly labels as non-English language,
  // verify the SPECIFIC matched set is truly an English set name
  // (prevents "Mega Evolution - Abyss Eye - Japanese" slipping through
  //  just because "mega evolution" is in ENGLISH_SETS)
  if (/\b(japanese|korean|chinese|simplified chinese|traditional chinese)\b/i.test(title)) {
    // The matched set must itself be a primary English set identifier,
    // not just a generic word that happens to be in ENGLISH_SETS
    const matchedSet = ENGLISH_SETS.find(set => set.length >= 6 && t.includes(set));
    if (!matchedSet) return false;
    // Also block if the matched set contains "mega evolution" generically
    // but the actual product is a Japanese sub-set of it
    const isJapaneseSubset = /\b(abyss eye|paradise dragona|stellar miracle|night wanderer|mask of change|clay burst|snow hazard|wild force|cyber judge|future flash|violet ex|scarlet ex|triplet beat|ancient roar|lost abyss|battle region|brilliant stars jp|fusion arts|blue sky stream|evolving skies jp|matchless fighters)\b/i.test(title);
    if (isJapaneseSubset) return false;
  }
  // Must be sealed product
  const ptype = getPtype(title);
  if (!ptype) return false;
  // Price sanity — minimum £3 filters out digital codes, single energy cards etc
  if (price < 3 || price > 3000) return false;
  return true;
}

// ─── EBAY API ──────────────────────────────────────────────────────────────────
let ebayToken = null;

async function getEbayToken() {
  if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET) return null;
  try {
    const creds = Buffer.from(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`).toString("base64");
    const res = await fetch(EBAY_AUTH_URL, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
    });
    if (!res.ok) { console.log("  ❌ eBay auth failed:", res.status); return null; }
    const data = res.json();
    console.log("  ✅ eBay token acquired (expires in 120min)");
    return data.access_token;
  } catch (e) {
    console.log("  ❌ eBay auth error:", e.message);
    return null;
  }
}

// ─── EBAY PRICE LOOKUP (Browse API) ───────────────────────────────────────────
const _ebayPriceCache = new Map();
const _externalPriceCache = new Map();

function buildEbaySearchQuery(title) {
  let t = title.toLowerCase();
  t = t.replace(/0% vat gvms/g,"").replace(/20% vat/g,"").replace(/gvms/g,"");
  t = t.replace(/acrylic case bundle/g,"").replace(/acrylic.*$/g,"");
  t = t.replace(/slightly damaged/g,"").replace(/cosmetic damage/g,"");
  t = t.replace(/scarlet and violet/g,"").replace(/scarlet & violet/g,"")
       .replace(/sword and shield/g,"").replace(/sword & shield/g,"")
       .replace(/sun and moon/g,"").replace(/sun & moon/g,"")
       .replace(/pokémon/g,"pokemon");
  t = t.replace(/[(][^)]*[)]/g,"");
  t = t.replace(/[-|:]/g," ").replace(/[^a-z0-9 ]/g," ");
  t = t.replace(/ (the|and|of|from|with|for|by|a|an|contains|total|authentic|expansion) /g," ");
  t = t.replace(/  +/g," ").trim();
  // Keep product type keywords so blisters match blisters, not booster boxes
  const keepType = ["booster box","elite trainer box","etb","booster bundle",
    "blister","mini tin","half booster box","booster pack","collection box",
    "premium collection","ultra premium","super premium"].find(k => t.includes(k));
  const query = ("pokemon " + t + (keepType ? "" : " sealed"))
    .replace(/pokemon pokemon/g,"pokemon")
    .replace(/  +/g," ").trim();
  return query;
}

// Max sensible eBay price per product type — filters bad matches
function maxEbayPrice(title) {
  const t = title.toLowerCase();
  if (t.includes("display case") || t.includes("sealed case")) return 2500;
  if (t.includes("booster box") || t.includes("36 pack") || t.includes("36x pack")) return 600;
  if (t.includes("half booster box") || t.includes("18 pack")) return 350;
  if (t.includes("ultra premium") || t.includes("super premium")) return 500;
  if (t.includes("elite trainer box") || t.includes(" etb")) return 350;
  if (t.includes("premium collection")) return 250;
  if (t.includes("booster bundle") || t.includes("6 pack") || t.includes("6x pack")) return 150;
  if (t.includes("3-pack blister") || t.includes("3 pack blister")) return 80;
  if (t.includes("blister") || t.includes("checklane")) return 60;
  if (t.includes("mini tin")) return 60;
  if (t.includes("booster pack") && !t.includes("box") && !t.includes("bundle")) return 50;
  if (t.includes("1-pack") || t.includes("single pack") || t.includes("1 pack blister") || t.includes("blister")) return 35;
  if (t.includes("tin")) return 150;
  return 500;
}

async function getEbaySoldPrice(title, token) {
  const cacheKey = title.toLowerCase().trim();
  if (_ebayPriceCache.has(cacheKey)) return _ebayPriceCache.get(cacheKey);
  if (!token) { _ebayPriceCache.set(cacheKey, null); return null; }

  const titleLower = title.toLowerCase();
  // Detect product type for price bounds
  const isEtb    = titleLower.includes("elite trainer") || titleLower.includes("etb");
  const isBox    = titleLower.includes("booster box") && !titleLower.includes("half");
  const isHalf   = titleLower.includes("half booster") || titleLower.includes("half box");
  const isBundle = titleLower.includes("booster bundle");
  const isPack   = titleLower.includes("booster pack") && !isBox && !isEtb && !isBundle && !isHalf;
  const isTin    = titleLower.includes(" tin") && !isBox && !isEtb;

  // Price bounds prevent multi-pack lots and outliers
  let priceMin, priceMax;
  if (titleLower.includes("ultra premium") || titleLower.includes("upc")) { priceMin=80; priceMax=450; }
  else if (isBox)    { priceMin=50;  priceMax=800; }
  else if (isHalf)   { priceMin=30;  priceMax=400; }
  else if (isEtb)    { priceMin=25;  priceMax=280; }
  else if (isBundle) { priceMin=12;  priceMax=120; }
  else if (isPack)   { priceMin=3;   priceMax=18; }
  else if (isTin)    { priceMin=10;  priceMax=80; }
  else               { priceMin=5;   priceMax=600; }

  // For packs: check if rare set (higher cap)
  if (isPack) {
    const veryRarePacks = ["hidden fates","shining fates","champions path","cosmic eclipse"];
    if (veryRarePacks.some(set => titleLower.includes(set))) priceMax = 35;
    const rarePacks = ["evolving skies","chilling reign","battle styles","prismatic evolutions",
                       "brilliant stars","darkness ablaze","vivid voltage","silver tempest",
                       "astral radiance","sword & shield","sword and shield"];
    if (rarePacks.some(set => titleLower.includes(set))) priceMax = 22;
  }

  const rawQuery = buildEbaySearchQuery(title);
  const queryWithPrefix = isPack ? "1x single " + rawQuery : rawQuery;

  const params = new URLSearchParams({
    q: queryWithPrefix,
    filter: "buyingOptions:{FIXED_PRICE},itemLocationCountry:GB,currency:GBP",
    sort: "bestMatch",
    limit: "20",
  });

  try {
    const res = await fetch(`${EBAY_BROWSE_URL}/item_summary/search?${params}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      if (res.status === 429) {
        console.log(`    eBay Browse API: HTTP 429 for "${title.slice(0,35)}" — backing off 4s`);
        await delay(4000);
        // One retry after backoff
        try {
          const retry = await fetch(`${EBAY_BROWSE_URL}/item_summary/search?${params}`, {
            headers: {
              "Authorization": `Bearer ${token}`,
              "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
              "Accept": "application/json",
            },
          });
          if (retry.ok) {
            const rd = retry.json();
            const ri = (rd?.itemSummaries||[]);
            if (ri.length) {
              const rp = parseFloat(ri[0]?.price?.value||0);
              if (rp > priceMin && rp < priceMax) {
                const result = { fairValue: rp, confidence: "LOW", sampleSize: 1, freshness: new Date().toISOString(), source: "ebay_browse_retry" };
                _ebayPriceCache.set(cacheKey, result);
                return result;
              }
            }
          }
        } catch(_) {}
      } else {
        console.log(`    eBay Browse API: HTTP ${res.status} for "${title.slice(0,35)}"`);
      }
      _ebayPriceCache.set(cacheKey, null);
      return null;
    }

    const data = res.json();
    const items = data?.itemSummaries || [];

    if (!items.length) {
      console.log(`    eBay Browse: no results for "${title.slice(0,35)}"`);
      _ebayPriceCache.set(cacheKey, null);
      return null;
    }

    const junk = [
    "lot "," lot","x2 ","x3 ","x4 ","x5 ","x10 "," 2x"," 3x"," 4x"," 5x",
    " 2 pack"," 3 pack"," 4 pack"," 5 pack","sealed (2)","sealed(2)","case of",
    "rip seal","ripped","resealed","graded","psa","bgs","cgc","damaged","opened",
    "[jp]","[kr]","[cn]","display case","acrylic",
    "near mint","lightly played","1st edition","reverse holo",
    "holo card","full art","alt art","mystery","twin pack","double pack",
    "empty box","box only","no cards",
  ];

    // Set name cross-validation (only for names > 5 chars)
    const setNames = Object.keys(HOLD_DATA);
    const searchedSet = setNames.find(sn => sn.length > 5 && titleLower.includes(sn)) || null;

    const prices = items
      .filter(item => {
        const t2 = (item.title || "").toLowerCase();
        if (junk.some(j => t2.includes(j))) return false;
        if (item.price?.currency !== "GBP") return false;
        const p = parseFloat(item.price?.value || 0);
        if (p < priceMin || p > priceMax) return false;
        // Only enforce set name check for longer names to reduce false negatives
        if (searchedSet && searchedSet.length > 8 && !t2.includes(searchedSet)) return false;
        return true;
      })
      .map(item => parseFloat(item.price?.value || 0))
      .filter(p => p > 0)
      .sort((a,b) => a-b);

    if (!prices.length) {
      console.log(`    eBay Browse: all results filtered for "${title.slice(0,35)}"`);
      _ebayPriceCache.set(cacheKey, null);
      return null;
    }

    // Trim cheapest 25% (damaged/fake) and top 15% (overpriced) for clean median
    const botPct = isPack ? 0.25 : 0.20;
    const topPct = isPack ? 0.25 : 0.15;
    const trimBot = Math.max(0, Math.floor(prices.length * botPct));
    const trimTop = Math.max(0, Math.floor(prices.length * topPct));
    const trimmed = prices.slice(trimBot, prices.length - trimTop);

    if (!trimmed.length) { _ebayPriceCache.set(cacheKey, null); return null; }

    const mean = trimmed.reduce((s,p) => s+p, 0) / trimmed.length;
    const fairValue = Math.round(mean * 100) / 100;

    let confidence = "LOW";
    if (trimmed.length >= 8) confidence = "HIGH";
    else if (trimmed.length >= 3) confidence = "MEDIUM";

    const result = { fairValue, confidence, sampleSize: trimmed.length,
                     freshness: new Date().toISOString(), source: "ebay_browse" };
    console.log(`    eBay market: "${title.slice(0,35)}" → £${fairValue} (n=${trimmed.length}, ${confidence})`);
    _ebayPriceCache.set(cacheKey, result);
    return result;

  } catch (e) {
    console.log(`    eBay Browse exception for "${title.slice(0,35)}": ${e.message}`);
    _ebayPriceCache.set(cacheKey, null);
    return null;
  }
}


// ─── EBAY FINDING API (Sold Listings) ─────────────────────────────────────────
// Uses App ID directly — no OAuth needed
// Returns actual completed sale prices — more accurate than BIN listings
// Combined with Browse API gives us the most complete market picture

const EBAY_FINDING_URL = "https://svcs.ebay.com/services/search/FindingService/v1";

async function getEbaySoldPrice_Finding(title) {
  if (!EBAY_CLIENT_ID) return null;
  
  const cacheKey = `finding:${title.toLowerCase().trim()}`;
  if (_externalPriceCache.has(cacheKey)) return _externalPriceCache.get(cacheKey);

  const query = buildEbaySearchQuery(title);
  
  const params = new URLSearchParams({
    "OPERATION-NAME": "findCompletedItems",
    "SERVICE-VERSION": "1.0.0",
    "SECURITY-APPNAME": EBAY_CLIENT_ID,
    "RESPONSE-DATA-FORMAT": "JSON",
    "siteid": "3",  // eBay UK
    "keywords": query,
    "itemFilter(0).name": "SoldItemsOnly",
    "itemFilter(0).value": "true",
    "itemFilter(1).name": "ListingCountry",
    "itemFilter(1).value": "3",
    "itemFilter(2).name": "HideDuplicateItems",
    "itemFilter(2).value": "true",
    "itemFilter(3).name": "Currency",
    "itemFilter(3).value": "GBP",
    "sortOrder": "EndTimeSoonest",
    "paginationInput.entriesPerPage": "20",
    "paginationInput.pageNumber": "1",
  });

  try {
    const res = await fetch(`${EBAY_FINDING_URL}?${params}`, {
      headers: { "User-Agent": "ShinyDen/1.0", "Accept": "application/json" },
      timeout: 10000,
    });

    if (!res.ok) {
      _externalPriceCache.set(cacheKey, null);
      return null;
    }

    const data = res.json();
    const response = data?.findCompletedItemsResponse?.[0];
    const ack = response?.ack?.[0];
    
    if (ack !== "Success" && ack !== "Warning") {
      _externalPriceCache.set(cacheKey, null);
      return null;
    }

    const items = response?.searchResult?.[0]?.item || [];
    if (!items.length) {
      _externalPriceCache.set(cacheKey, null);
      return null;
    }

    const titleLower = title.toLowerCase();
    const isPack = titleLower.includes("booster pack") && !titleLower.includes("booster box");
    
    const junk = ["lot "," lot","x2","x3","x4","x5","sealed (2)","case of",
                  "graded","psa","bgs","cgc","[jp]","[kr]","damaged","opened","resealed","ripped"];

    const prices = items
      .filter(item => {
        const t2 = (item.title?.[0] || "").toLowerCase();
        if (junk.some(j => t2.includes(j))) return false;
        const currency = item.sellingStatus?.[0]?.currentPrice?.[0]?.["@currencyId"];
        if (currency !== "GBP") return false;
        const p = parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.["__value__"] || 0);
        if (isPack && p > 18) return false;
        if (isPack && p > 280) return false;
        return p > 0;
      })
      .map(item => parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.["__value__"] || 0))
      .filter(p => p > 0)
      .sort((a,b) => a-b);

    if (!prices.length) {
      _externalPriceCache.set(cacheKey, null);
      return null;
    }

    // Trim outliers: bottom 15%, top 20%
    const trimBot = Math.max(0, Math.floor(prices.length * 0.15));
    const trimTop = Math.max(0, Math.floor(prices.length * 0.20));
    const trimmed = prices.slice(trimBot, prices.length - trimTop);
    if (!trimmed.length) { _externalPriceCache.set(cacheKey, null); return null; }

    const mean = trimmed.reduce((s,p) => s+p, 0) / trimmed.length;
    const fairValue = Math.round(mean * 100) / 100;
    
    let confidence = "LOW";
    if (trimmed.length >= 8) confidence = "HIGH";
    else if (trimmed.length >= 3) confidence = "MEDIUM";

    const result = { fairValue, confidence, sampleSize: trimmed.length,
                     source: "ebay_sold", freshness: new Date().toISOString() };
    console.log(`    eBay SOLD: "${title.slice(0,35)}" → £${fairValue} (n=${trimmed.length}, ${confidence})`);
    _externalPriceCache.set(cacheKey, result);
    return result;

  } catch (e) {
    _externalPriceCache.set(cacheKey, null);
    return null;
  }
}

// ─── COMBINED PRICE: Sold (60%) + BIN (40%) ────────────────────────────────────
// Sold prices are more accurate (actual transactions) so weighted higher
async function getCombinedPrice(title, token) {
  // Browse API only for now — Finding API (sold listings) requires special
  // account approval. Enable soldResult below once approved.
  const browseResult = await getEbaySoldPrice(title, token);
  // const soldResult = await getEbaySoldPrice_Finding(title); // ← enable when approved
  return browseResult;
}

// ─── DEAL SCORE (0-100) ────────────────────────────────────────────────────────
function computeDealScore(buy, rrp, ebayResult, holdData) {
  let score = 30;
  const market = ebayResult?.fairValue || getMarket("") || null;
  if (!market || !buy) return score;

  // Private UK sellers pay 0% eBay fees on trading cards/collectibles
  const net = market - buy - POST;
  const roi = buy > 0 ? (net / buy) * 100 : 0;

  // Flip ROI component (0-50 pts)
  if (roi >= 25)       score += 50;
  else if (roi >= 15)  score += 38;
  else if (roi >= 8)   score += 25;
  else if (roi >= 2)   score += 12;
  else if (roi >= 0)   score += 4;
  else                 score -= 15;

  // eBay confidence bonus (0-10 pts)
  if (ebayResult?.confidence === "HIGH")   score += 10;
  else if (ebayResult?.confidence === "MEDIUM") score += 5;

  // Hold bonus (0-15 pts)
  if (holdData) {
    const hs = holdData.score || 5;
    score += Math.min(15, Math.round(hs * 1.5));
  }

  // RRP discount bonus (0-10 pts)
  if (rrp && buy < rrp) {
    const rrpDisc = (rrp - buy) / rrp;
    if (rrpDisc > 0.3) score += 10;
    else if (rrpDisc > 0.15) score += 5;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function gradeFromScore(score, hasHoldData) {
  if (score >= 82) return "S";
  if (score >= 68) return "A";
  if (score >= 54) return "B";
  if (score >= 40) return "C";
  if (score >= 28 && hasHoldData) return "H";
  return "D";
}

// ─── EBAY LIVE DEAL SCANNER ────────────────────────────────────────────────────
// Searches eBay UK directly for underpriced sealed Pokémon
// Writes to ebay_deals.json — completely separate from deals.json

const EBAY_SEARCH_TARGETS = [
  // ── HIGH-VALUE SEALED ── sourced from actual eBay UK sold May 2026
  { q:"pokemon evolving skies booster box sealed english",        type:"Booster Box",    marketMin:170, marketMax:240 },
  { q:"pokemon evolving skies elite trainer box sealed english",  type:"ETB",            marketMin:130, marketMax:175 },
  { q:"pokemon hidden fates elite trainer box sealed english",    type:"ETB",            marketMin:270, marketMax:350 },
  { q:"pokemon shining fates elite trainer box sealed english",   type:"ETB",            marketMin:90,  marketMax:130 },
  { q:"pokemon champions path elite trainer box sealed english",  type:"ETB",            marketMin:110, marketMax:160 },
  { q:"pokemon chilling reign booster box sealed english",        type:"Booster Box",    marketMin:190, marketMax:240 },
  { q:"pokemon chilling reign elite trainer box sealed english",  type:"ETB",            marketMin:130, marketMax:165 },
  { q:"pokemon brilliant stars booster box sealed english",       type:"Booster Box",    marketMin:140, marketMax:185 },
  { q:"pokemon brilliant stars elite trainer box sealed english",  type:"ETB",           marketMin:120, marketMax:160 },
  { q:"pokemon astral radiance elite trainer box sealed english",  type:"ETB",           marketMin:120, marketMax:155 },
  { q:"pokemon lost origin elite trainer box sealed english",     type:"ETB",            marketMin:175, marketMax:230 },
  { q:"pokemon silver tempest booster box sealed english",        type:"Booster Box",    marketMin:120, marketMax:160 },
  { q:"pokemon silver tempest elite trainer box sealed english",  type:"ETB",            marketMin:100, marketMax:140 },
  { q:"pokemon crown zenith elite trainer box sealed english",    type:"ETB",            marketMin:240, marketMax:300 },
  { q:"pokemon surging sparks booster box sealed english",        type:"Booster Box",    marketMin:200, marketMax:280 },
  { q:"pokemon surging sparks elite trainer box sealed english",  type:"ETB",            marketMin:110, marketMax:155 },
  { q:"pokemon prismatic evolutions elite trainer box sealed english", type:"ETB",       marketMin:135, marketMax:185 },
  { q:"pokemon 151 elite trainer box sealed english",             type:"ETB",            marketMin:95,  marketMax:135 },
  { q:"pokemon 151 booster bundle sealed english",                type:"Booster Bundle", marketMin:55,  marketMax:80  },
  { q:"pokemon paradox rift booster box sealed english",          type:"Booster Box",    marketMin:120, marketMax:165 },
  { q:"pokemon paradox rift elite trainer box sealed english",    type:"ETB",            marketMin:115, marketMax:155 },
  { q:"pokemon temporal forces booster box sealed english",       type:"Booster Box",    marketMin:80,  marketMax:120 },
  { q:"pokemon temporal forces elite trainer box sealed english", type:"ETB",            marketMin:85,  marketMax:120 },
  { q:"pokemon twilight masquerade booster box sealed english",   type:"Booster Box",    marketMin:80,  marketMax:120 },
  { q:"pokemon twilight masquerade elite trainer box sealed english", type:"ETB",        marketMin:100, marketMax:140 },
  { q:"pokemon stellar crown booster box sealed english",         type:"Booster Box",    marketMin:100, marketMax:145 },
  { q:"pokemon stellar crown elite trainer box sealed english",   type:"ETB",            marketMin:90,  marketMax:130 },
  { q:"pokemon shrouded fable elite trainer box sealed english",  type:"ETB",            marketMin:90,  marketMax:130 },
  { q:"pokemon destined rivals booster box sealed english",       type:"Booster Box",    marketMin:140, marketMax:200 },
  { q:"pokemon destined rivals elite trainer box sealed english", type:"ETB",            marketMin:140, marketMax:185 },
  { q:"pokemon journey together booster box sealed english",      type:"Booster Box",    marketMin:140, marketMax:200 },
  { q:"pokemon journey together elite trainer box sealed english", type:"ETB",           marketMin:105, marketMax:145 },
  { q:"pokemon fusion strike booster box sealed english",         type:"Booster Box",    marketMin:65,  marketMax:100 },
  { q:"pokemon darkness ablaze booster box sealed english",       type:"Booster Box",    marketMin:140, marketMax:185 },
  { q:"pokemon paldean fates elite trainer box sealed english",   type:"ETB",            marketMin:45,  marketMax:75  },
  { q:"pokemon obsidian flames booster box sealed english",       type:"Booster Box",    marketMin:190, marketMax:255 },
  { q:"pokemon cosmic eclipse booster box sealed english",        type:"Booster Box",    marketMin:220, marketMax:350 },
  { q:"pokemon rebel clash booster box sealed english",           type:"Booster Box",    marketMin:185, marketMax:260 },
  // Japanese/Korean sets - no english filter, include all variants
  { q:"pokemon journey together half booster box",                type:"Half Box",       marketMin:85,  marketMax:130 },
  { q:"pokemon battle partners japanese booster box",             type:"Booster Box",    marketMin:55,  marketMax:95  },
  { q:"pokemon terastal festival japanese booster box",           type:"Booster Box",    marketMin:80,  marketMax:130 },
  { q:"pokemon white flare japanese booster box",                 type:"Booster Box",    marketMin:120, marketMax:180 },
  { q:"pokemon black bolt korean booster box",                    type:"Booster Box",    marketMin:50,  marketMax:85  },
  { q:"pokemon nihil zero korean booster box",                    type:"Booster Box",    marketMin:45,  marketMax:75  },
  { q:"pokemon heatwave arena korean booster box",                type:"Booster Box",    marketMin:45,  marketMax:80  },
  { q:"pokemon glory of team rocket japanese booster box",        type:"Booster Box",    marketMin:160, marketMax:220 },
  { q:"pokemon glory of team rocket korean booster box",          type:"Booster Box",    marketMin:45,  marketMax:75  },
  { q:"pokemon perfect order elite trainer box sealed",           type:"ETB",            marketMin:55,  marketMax:90  },
  { q:"pokemon ascended heroes booster box sealed english",       type:"Booster Box",    marketMin:100, marketMax:145 },
];

const EBAY_MIN_DISCOUNT_PCT = 8;

async function scanEbayForDeals(token) {
  if (!token) { console.log("  ⚠️ No eBay token — skipping eBay deal scan"); return []; }
  console.log("\n🛒 Scanning eBay UK for live deals...");
  const deals = [];
  const junk = [
    "lot "," lot","x2 ","x3 ","x4 ","x5 ","x10 ",
    "sealed (2)","sealed(2)","case of",
    "rip ","ripped","damaged","opened","resealed",
    "[jp]","[kr]","[cn]",
    "bundle of","graded","psa ","bgs ","cgc ",
    "twin pack","double pack","mystery","random ",
    "empty","display box","box only",
  ];

  for (const target of EBAY_SEARCH_TARGETS) {
    try {
      await delay(300); // respect rate limits between scan targets
      const params = new URLSearchParams({
        q: target.q,
        filter: "buyingOptions:{FIXED_PRICE},itemLocationCountry:GB,currency:GBP",
        sort: "bestMatch",
        limit: "20",
      });

      const res = await fetch(`${EBAY_BROWSE_URL}/item_summary/search?${params}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
          "Accept": "application/json",
        },
      });

      if (!res.ok) {
        if (res.status === 429) { await delay(2000); continue; }
        continue;
      }
      const data = res.json();
      const items = data?.itemSummaries || [];

      for (const item of items) {
        const title = item.title || "";
        const tl = title.toLowerCase();
        const price = parseFloat(item.price?.value || 0);
        if (!price || item.price?.currency !== "GBP") continue;
        if (junk.some(j => tl.includes(j))) continue;
        if (price < target.marketMin * 0.5) continue;

        const dealThreshold = target.marketMin * (1 - EBAY_MIN_DISCOUNT_PCT / 100);
        if (price > dealThreshold) continue;

        const midMarket = (target.marketMin + target.marketMax) / 2;
        const fvf = midMarket * EF + FEE_FIXED;
        const netProfit = +(midMarket - price - fvf - POST).toFixed(2);
        const roi = Math.round(netProfit / price * 100);
        const pctBelow = Math.round((1 - price / target.marketMin) * 100);

        if (roi < 5) continue;

        const image = item.thumbnailImages?.[0]?.imageUrl || item.image?.imageUrl || null;
        deals.push({
          id: item.itemId,
          title, type: target.type, price, marketFloor: target.marketMin,
          marketCeil: target.marketMax, midMarket, netProfit, roi, pctBelow,
          image, url: item.itemWebUrl || "", condition: item.condition || "New",
          source: "ebay_live", scannedAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.log(`  eBay scan error: ${e.message}`);
    }
    await delay(500);
  }

  const seen = new Set();
  const unique = deals
    .filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true; })
    .sort((a,b) => b.roi - a.roi);

  console.log(`  📦 Found ${unique.length} eBay live deals`);
  return unique;
}

// ─── GITHUB SAVE ───────────────────────────────────────────────────────────────
async function saveToGitHub(filename, content) {
  if (!GH_TOKEN) { console.log(`⚠️ No GH_TOKEN — skipping ${filename}`); return; }
  try {
    let sha;
    try {
      const ex = await fetch(
        `https://api.github.com/repos/${GH_REPO}/contents/${filename}`,
        { headers: { Authorization: `token ${GH_TOKEN}`, "User-Agent": "pokescraper" } }
      );
      if (ex.ok) sha = (await ex.json()).sha;
    } catch {}

    const b64 = Buffer.from(JSON.stringify(content, null, 2)).toString("base64");
    const res = await fetch(
      `https://api.github.com/repos/${GH_REPO}/contents/${filename}`,
      {
        method: "PUT",
        headers: { Authorization: `token ${GH_TOKEN}`, "Content-Type": "application/json", "User-Agent": "pokescraper" },
        body: JSON.stringify({ message: `update ${filename} ${new Date().toISOString()}`, content: b64, ...(sha ? {sha} : {}) }),
      }
    );
    if (res.ok) console.log(`✅ Saved ${filename}`);
    else console.log(`❌ Save error for ${filename}:`, (await res.json()).message);
  } catch (e) {
    console.log(`❌ Save error for ${filename}:`, e.message);
  }
}

// ─── TELEGRAM ALERT ────────────────────────────────────────────────────────────
async function sendAlert(deal) {
  if (!TELE_TOKEN || !TELE_CHAT) return;
  try {
    const market = deal.resell || getMarket(deal.product) || 0;
    const fvf = market * EF + FEE_FIXED;
    const net = +(market - deal.buyNow - fvf - POST).toFixed(2);
    const roi = deal.buyNow > 0 ? Math.round(net / deal.buyNow * 100) : 0;
    const msg = `🔥 *ShinyDen Deal Alert*\n\n*${deal.product}*\n_${deal.retailer}_\n\n💰 Buy: £${deal.buyNow}\n📈 eBay: £${market}\n✅ Profit: +£${net} (+${roi}%)\n\n${deal.url}`;
    await fetch(`https://api.telegram.org/bot${TELE_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELE_CHAT, text: msg, parse_mode: "Markdown" }),
    });
  } catch {}
}

// ─── RETAILERS ─────────────────────────────────────────────────────────────────
const retailers = [
  // ── Confirmed working retailers ────────────────────────────────────────────
  { name:"Total Cards",         base:"https://www.totalcards.net",            type:"shopify-json",
    collections:["/collections/pokemon-sealed-products","/collections/pokemon","/products"] },
  { name:"Titan Cards",         base:"https://titancards.co.uk",              type:"shopify-json",
    collections:["/products","/collections/pokemon-sealed","/collections/pokemon"] },
  { name:"Eterna Cards",        base:"https://eternacards.co.uk",             type:"shopify-json",
    collections:["/products","/collections/pokemon-tcg-sealed-products","/collections/pokemon"] },
  { name:"Double Sleeved",      base:"https://www.doublesleeved.co.uk",       type:"shopify-json",
    collections:["/products","/collections/pokemon-sealed","/collections/pokemon"] },
  { name:"My TCG",              base:"https://www.mytcg.co.uk",               type:"shopify-json",
    collections:["/products","/collections/pokemon-sealed-product","/collections/pokemon"] },
  // Zatu Games - DNS issues, skip
  // { name:"Zatu Games", base:"https://www.zatugames.com", type:"shopify-json", collections:[] },
  { name:"Toys N Geek",         base:"https://www.toysngeek.co.uk",           type:"shopify-json",
    collections:["/products","/collections/pokemon","/collections/trading-cards"] },
  { name:"Gathering Games",     base:"https://www.gatheringgames.co.uk",      type:"shopify-json",
    collections:["/products","/collections/pokemon","/collections/all"] },
  // ── Fixed domains ──────────────────────────────────────────────────────────
  { name:"Evo Cards",           base:"https://evocards.co.uk",                type:"shopify-json",
    collections:["/products","/collections/pokemon-sealed-products","/collections/pokemon"] },
  // ── New retailers found ────────────────────────────────────────────────────
  { name:"Invicta TCG",         base:"https://invictatcg.co.uk",              type:"shopify-json",
    collections:["/products","/collections/pokemon","/collections/pokemon-sealed"] },
  { name:"The Card Vault",      base:"https://thecardvault.co.uk",            type:"shopify-json",
    collections:["/collections/pokemon-tcg-sealed-products","/collections/sealed-product","/collections/all","/products"] },
  // Pulse Collective - 404s on all endpoints
  // { name:"Pulse Collective", base:"https://www.pulsecollective.co.uk", type:"shopify-json", collections:[] },
  // ── Variable retailers (403/slower but worth trying) ──────────────────────
  { name:"Chaos Cards",         base:"https://www.chaoscards.co.uk",          type:"shopify-json",
    collections:["/collections/pokemon","/collections/tcg-pokemon"] },
  { name:"Leisure Games",       base:"https://www.leisuregames.com",          type:"shopify-json",
    collections:["/products","/collections/pokemon","/collections/trading-card-games"] },
  { name:"Minted TCG",          base:"https://www.mintedtcg.co.uk",           type:"shopify-json",
    collections:["/products","/collections/pokemon-sealed","/collections/pokemon"] },
  { name:"Goblin Gaming",       base:"https://www.goblingaming.co.uk",        type:"shopify-json",
    collections:["/products","/collections/pokemon"] },
  // ── Additional working retailers ──────────────────────────────────────────
  { name:"Big Orbit Cards",    base:"https://www.bigorbitcards.co.uk",      type:"shopify-json",
    collections:["/collections/pokemon-sealed","/collections/pokemon","/products"] },
  { name:"Chaos Cards",        base:"https://www.chaoscards.co.uk",         type:"shopify-json",
    collections:["/collections/pokemon-sealed-products","/collections/pokemon"] },
  { name:"Leisure Games",      base:"https://leisuregames.com",             type:"shopify-json",
    collections:["/collections/pokemon-sealed","/collections/pokemon-cards","/collections/pokemon"] },
  { name:"Card Merchant",      base:"https://www.cardmerchant.co.uk",       type:"shopify-json",
    collections:["/collections/pokemon","/collections/pokemon-sealed","/products"] },
  { name:"Ace Comics",         base:"https://www.acecomics.co.uk",          type:"shopify-json",
    collections:["/collections/pokemon","/collections/pokemon-cards","/products"] },
  // Magic Madhouse - returns HTML not JSON
  // { name:"Magic Madhouse", base:"https://www.magicmadhouse.co.uk", type:"shopify-json", collections:[] },
  // PACKRAT - returns HTML not JSON
  // { name:"PACKRAT", base:"https://packrat.co.uk", type:"shopify-json", collections:[] },
  // Emerald Collectables - DNS NXDOMAIN, site down
  // { name:"Emerald Collectables", base:"https://www.emeraldcollectables.co.uk", type:"shopify-json", collections:[] },
  // Pokemon Center UK - 403
  // { name:"Pokemon Center UK", base:"https://www.pokemoncenter.com", type:"shopify-json", collections:[] },
];

// ─── SCRAPE A SINGLE RETAILER ──────────────────────────────────────────────────
async function scrapeRetailer(retailer) {
  if (retailer.type === "skip") return [];
  const found = [];

  let gotProducts = false;
  for (const col of (retailer.collections || [])) {
    // Once we've found products from one endpoint, stop trying others
    if (gotProducts) break;
    let page = 1;
    while (true) {
      try {
        const url = `${retailer.base}${col}.json?limit=250&page=${page}`;
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; ShinyDen/1.0)", "Accept": "application/json" },
          timeout: 10000,
        });

        if (!res.ok) {
          if (res.status === 403 || res.status === 404) {
            console.log(`     HTTP ${res.status} — skipping`);
            break;
          }
          break;
        }

        const text = res.text();
        let data;
        try { data = JSON.parse(text); }
        catch { console.log(`     Error: Unexpected token '${text[0]}'...`); break; }

        const products = data.products || data.items || [];
        if (!products.length) break;

        gotProducts = true;
        for (const p of products) {
          const title = p.title || p.name || "";
          const variants = p.variants || p.options || [p];
          for (const v of variants) {
            const price = parseFloat(v.price || v.retail_price || 0);
            if (!isValidProduct(title, price)) continue;
            // Skip out-of-stock products — Shopify sets available:false when sold out
            // available===false means explicitly out of stock; null/undefined = assume in stock
            const inStock = v.available !== false && (p.available === undefined || p.available !== false);
            if (!inStock) continue;
            const url2 = v.url || (p.handle ? `${retailer.base}/products/${p.handle}` : retailer.url || "");
            const image = p.images?.[0]?.src || p.image?.src || null;
            found.push({ title: title.trim(), price, url: url2, image, retailer: retailer.name });
          }
        }

        if (products.length < 250) break;
        page++;
        await delay(300);
      } catch (e) {
        console.log(`     Error: ${e.message}`);
        break;
      }
    }
  }
  return found;
}

// ─── MAIN SCAN ─────────────────────────────────────────────────────────────────
async function runScan() {
  console.log(`\n🔍 ${retailers.filter(r=>r.type!=="skip").length} retailers · ${new Date().toISOString().slice(11,19)}`);

  // Get eBay token
  const token = await getEbayToken();
  ebayToken = token;
  if (token) console.log("  📡 eBay Browse API ready");

  const seenPrices = new Map(); // retailer::title → last known price
  const findings = [];

  // Run retailers in parallel batches of 5 — cuts scan time from 7min to ~90sec
  const BATCH_SIZE = 5;
  const activeRetailers = retailers.filter(r => r.type !== "skip");
  
  for (let i = 0; i < activeRetailers.length; i += BATCH_SIZE) {
    const batch = activeRetailers.slice(i, i + BATCH_SIZE);
    console.log(`  ── Batch ${Math.floor(i/BATCH_SIZE)+1}: ${batch.map(r=>r.name).join(", ")}`);
    
    const results = await Promise.allSettled(
      batch.map(async retailer => {
        try {
          const items = await scrapeRetailer(retailer);
          console.log(`    ✓ ${retailer.name}: ${items.length} products`);
          return { retailer: retailer.name, items };
        } catch (e) {
          console.log(`    ✗ ${retailer.name}: ${e.message}`);
          return { retailer: retailer.name, items: [] };
        }
      })
    );
    
    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const { retailer: retailerName, items } = result.value;
      
      for (const item of items) {
        const key = `${retailerName}::${item.title.toLowerCase().trim()}`;
        const old = seenPrices.get(key);
        const isNew = !old;
        const isPriceDrop = old && item.price < old.price * 0.95;
        
        if (isNew || isPriceDrop) {
          console.log(`    🟢 "${item.title}" £${item.price}`);
          findings.push({ ...item, retailer: retailerName, isPriceDrop, oldPrice: old?.price || null });
          seenPrices.set(key, { price: item.price });
        }
      }
    }
    // Small pause between batches to be respectful
    if (i + BATCH_SIZE < activeRetailers.length) await delay(200);
  }

    console.log(`\n📊 ${findings.length} new confirmed deals`);

  // Alert on genuinely good deals
  const alertWorthy = findings.filter(f => {
    const market = getMarket(f.title);
    if (!market) return false;
    const fvf = market * EF + FEE_FIXED;
    const net = market - f.price - fvf - POST;
    const roi = Math.round((net / f.price) * 100);
    return roi >= 15;
  });

  console.log(`📣 ${alertWorthy.length} alert-worthy deals (ROI ≥ 15%)`);
  for (const f of alertWorthy) {
    await sendAlert(f);
    await delay(1200);
  }

  if (!findings.length) console.log("  ⬛ Nothing new this scan.");
  return findings;
}

// ─── STARTUP ───────────────────────────────────────────────────────────────────
console.log("🚀 Lock3y's PokéScraper — GitHub Actions");
console.log("🇬🇧 English sealed products only · All expansions");
console.log("📊 Shopify JSON API · Full deal intelligence\n");

(async () => {
  try {
    const found = await runScan();

    if (found && found.length > 0) {
      // ── eBay live deals scan runs FIRST before enrichment ──
      // Enrichment makes 800+ eBay API calls causing rate limits (429).
      // Running scan first guarantees it gets fresh token quota.
      const ebayDeals = await scanEbayForDeals(ebayToken);
      if (ebayDeals.length > 0) {
        await saveToGitHub("ebay_deals.json", {
          deals: ebayDeals,
          updatedAt: new Date().toISOString(),
          count: ebayDeals.length,
        });
        console.log(`✅ Saved ebay_deals.json`);
      } else {
        console.log("  ℹ️ No eBay deals found this scan");
      }

      console.log("\n📡 Enriching deals with eBay market data...");

      // Deduplicate by product title before eBay enrichment
      // Same product from multiple retailers → only look up eBay price once
      const titlesSeen = new Map(); // title → ebay result
      const enriched = [];
      for (const f of found) {
        const rrp      = getRRP(f.title);
        const holdData = getHoldData(f.title);
        // Use cached eBay result if same title already enriched this run
        const titleKey = f.title.toLowerCase().trim();
        let ebayResult;
        if (titlesSeen.has(titleKey)) {
          ebayResult = titlesSeen.get(titleKey);
        } else {
          ebayResult = await getCombinedPrice(f.title, ebayToken);
          titlesSeen.set(titleKey, ebayResult);
          await delay(250);
        }

        const resellFromMarket = getMarket(f.title);
        // Sanity check: if eBay price exceeds max for this product type, discard it
        const maxEbay = maxEbayPrice(f.title);
        const ebayFairValue = ebayResult?.fairValue;
        const ebayValid = ebayFairValue && ebayFairValue <= maxEbay;
        const resell = (ebayValid ? ebayFairValue : null) || resellFromMarket || null;
        const dealScore = computeDealScore(f.price, rrp, ebayResult, holdData);
        const grade = gradeFromScore(dealScore, !!holdData);

        enriched.push({
          id: `${f.retailer}::${f.title.toLowerCase().trim()}`,
          product: f.title,
          retailer: f.retailer,
          buyNow: f.price,
          rrp, resell, dealScore, grade,
          resellSource: ebayResult?.source || (resellFromMarket ? "static_table" : null),
          resellConfidence: ebayResult?.confidence || null,
          resellSampleSize: ebayResult?.sampleSize || null,
          resellFreshness: ebayResult?.freshness || null,
          url: f.url,
          image: f.image || null,
          lastSeen: new Date().toISOString(),
          isPriceDrop: f.isPriceDrop || false,
          oldPrice: f.oldPrice || null,
        });
      }

      // Save deals.json with holdData envelope (Phase 5)
      await saveToGitHub("deals.json", {
        deals: enriched,
        holdData: HOLD_DATA,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error("Fatal:", e.message);
    process.exit(1);
  }
  console.log("\n✅ Done.");
  process.exit(0);
})();
