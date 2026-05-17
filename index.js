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
  "phantasmal flames","mega evolution","mega lucario","nihil zero",
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
  "japanese","korean","chinese","german","french","italian","spanish",
  "Portuguese","dutch","polish","russian",
  "[jp]","japanese version","japanese ed",
  "proxy","custom","fake","replica","unofficial","fanmade","fan made",
  "energy card","trainer card","supporter card","item card","tool card",
  "lot","bundle of cards","card lot",
  "mystery bundle cards","panini","topps","bandai cards",
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
  // Mega Evolution (2025-2026)
  "ascended heroes booster box":           125,
  "ascended heroes elite trainer box":     160,
  "ascended heroes etb":                   160,
  "phantasmal flames booster box":         360,
  "phantasmal flames elite trainer box":   120,
  "phantasmal flames etb":                 120,
  "perfect order booster pack":             8,
  "perfect order booster box":            130,
  "destined rivals booster box":           125,
  "destined rivals elite trainer box":      58,
  "destined rivals etb":                    58,
  "destined rivals booster bundle":         32,
  "destined rivals booster pack":            7,
  // Scarlet & Violet
  "surging sparks booster box":            250,
  "surging sparks elite trainer box":       65,
  "surging sparks etb":                     65,
  "surging sparks booster bundle":          28,
  "surging sparks booster pack":             8,
  "stellar crown booster box":             150,
  "stellar crown elite trainer box":        48,
  "twilight masquerade booster box":       160,
  "twilight masquerade elite trainer box":  48,
  "temporal forces booster box":           155,
  "temporal forces elite trainer box":      48,
  "paradox rift booster box":              170,
  "paradox rift elite trainer box":         50,
  "obsidian flames booster box":           180,
  "obsidian flames elite trainer box":      52,
  "paldea evolved booster box":            145,
  "paldea evolved elite trainer box":       46,
  "paldean fates elite trainer box":        80,
  "scarlet & violet booster box":          140,
  "scarlet & violet elite trainer box":     44,
  "scarlet violet elite trainer box":       44,
  "151 booster box":                       210,
  "151 elite trainer box":                  68,
  "151 booster bundle":                     50,
  "journey together booster box":          130,
  "journey together elite trainer box":     52,
  "journey together booster pack":           7,
  // Sword & Shield
  "crown zenith booster box":              320,
  "crown zenith elite trainer box":        118,
  "crown zenith etb":                      118,
  "silver tempest booster box":            420,
  "silver tempest elite trainer box":      108,
  "silver tempest etb":                    108,
  "silver tempest booster pack":            12,
  "lost origin booster box":               200,
  "lost origin elite trainer box":          95,
  "lost origin etb":                        95,
  "astral radiance booster box":           195,
  "astral radiance elite trainer box":     100,
  "astral radiance etb":                   100,
  "brilliant stars booster box":           225,
  "brilliant stars elite trainer box":     148,
  "brilliant stars etb":                   148,
  "brilliant stars booster pack":           11,
  "fusion strike booster box":             215,
  "fusion strike elite trainer box":        95,
  "fusion strike etb":                      95,
  "evolving skies booster box":            220,
  "evolving skies elite trainer box":      155,
  "evolving skies etb":                    155,
  "evolving skies booster pack":            14,
  "chilling reign booster box":            245,
  "chilling reign elite trainer box":      115,
  "chilling reign etb":                    115,
  "chilling reign booster pack":            13,
  "battle styles booster box":             285,
  "battle styles elite trainer box":       132,
  "battle styles etb":                     132,
  "battle styles booster pack":             10,
  "shining fates elite trainer box":       120,
  "shining fates etb":                     120,
  "shining fates booster pack":             15,
  "vivid voltage booster box":             195,
  "vivid voltage elite trainer box":        68,
  "vivid voltage booster pack":             11,
  "champions path elite trainer box":      280,
  "champions path etb":                    280,
  "champions path booster pack":            25,
  "darkness ablaze booster box":           175,
  "darkness ablaze elite trainer box":      68,
  "darkness ablaze etb":                    68,
  "darkness ablaze booster pack":           10,
  "rebel clash booster box":               170,
  "rebel clash elite trainer box":          60,
  "rebel clash booster pack":               11,
  "sword & shield booster box":            165,
  "sword & shield elite trainer box":       55,
  "sword & shield booster pack":            12,
  // Sun & Moon
  "hidden fates booster box":              350,
  "hidden fates elite trainer box":        180,
  "hidden fates etb":                      180,
  "cosmic eclipse booster box":            280,
  "cosmic eclipse elite trainer box":       85,
  "unified minds booster box":             180,
  "unbroken bonds booster box":            195,
  "team up booster box":                   165,
  // Older
  "celebrations elite trainer box":         90,
  "pokemon go elite trainer box":           65,
  "pokemon go booster bundle":              35,
};

function getMarket(title) {
  const t = title.toLowerCase();
  for (const [k, v] of Object.entries(MARKET)) {
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
  if (t.includes("half booster") || t.includes("half box")) return "Half Box";
  if (t.includes("booster box")) return "Booster Box";
  if (t.includes("elite trainer") || t.includes("etb")) return "ETB";
  if (t.includes("booster bundle")) return "Booster Bundle";
  if (t.includes("premium collection")) return "Premium Collection";
  if (t.includes("collection box") || t.includes("special collection")) return "Collection Box";
  if (t.includes("booster pack") || t.includes("single booster")) return "Booster Pack";
  if (t.includes("mini tin")) return "Mini Tin";
  if (t.includes("tin")) return "Tin";
  if (t.includes("blister")) return "Blister";
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
  // Block individual cards (card number pattern like 053/198)
  if (/\b\d{1,3}\/\d{2,3}\b/.test(t)) return false;
  // Must be Pokemon
  if (!t.includes("pokemon") && !t.includes("pokémon") && !t.includes("pok")) return false;
  // Must have a valid set
  const hasSet = ENGLISH_SETS.some(s => t.includes(s));
  if (!hasSet) return false;
  // Must be sealed product
  const ptype = getPtype(title);
  if (!ptype) return false;
  // Price sanity
  if (price <= 0 || price > 3000) return false;
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
  t = t.replace(/slightly damaged/g,"");
  t = t.replace(/scarlet and violet/g,"").replace(/scarlet & violet/g,"")
       .replace(/sword and shield/g,"").replace(/sword & shield/g,"")
       .replace(/sun and moon/g,"").replace(/sun & moon/g,"")
       .replace(/pokémon/g,"pokemon");
  t = t.replace(/[(][^)]*[)]/g,"");
  t = t.replace(/[-|:]/g," ").replace(/[^a-z0-9 ]/g," ");
  t = t.replace(/ (the|and|of|from|with|for|by|a|an|contains|total|authentic|expansion) /g," ");
  t = t.replace(/  +/g," ").trim();
  const query = ("pokemon " + t + " sealed")
    .replace(/pokemon pokemon/g,"pokemon")
    .replace(/  +/g," ").trim();
  return query;
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
    const rarePackSets = ["hidden fates","shining fates","champions path","cosmic eclipse",
                          "evolving skies","chilling reign","battle styles","prismatic evolutions"];
    if (rarePackSets.some(s => titleLower.includes(s))) priceMax = 28;
  }

  const rawQuery = buildEbaySearchQuery(title);
  const queryWithPrefix = isPack ? "1x single " + rawQuery : rawQuery;

  const params = new URLSearchParams({
    q: queryWithPrefix,
    filter: "buyingOptions:{FIXED_PRICE},itemLocationCountry:GB,currency:GBP",
    sort: "price",
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
      console.log(`    eBay Browse API: HTTP ${res.status} for "${title.slice(0,35)}"`);
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

    const junk = ["lot "," lot","x2 ","x3 ","x4 ","x5 ","x10 "," 2x"," 3x"," 4x"," 5x",
                  " 2 pack"," 3 pack"," 4 pack"," 5 pack","sealed (2)","sealed(2)","case of",
                  "rip seal","graded","psa","bgs","damaged","opened",
                  "korean","japanese","[jp]","display case","acrylic",
                  "near mint","lightly played","1st edition","reverse holo",
                  "holo card","full art","alt art","mystery","twin pack","double pack"];

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
        if (searchedSet && !t2.includes(searchedSet)) return false;
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

    // Aggressive trimming for packs, standard for others
    const botPct = isPack ? 0.20 : 0.15;
    const topPct = isPack ? 0.30 : 0.20;
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
                  "graded","psa","bgs","korean","japanese","[jp]","damaged","opened"];

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
  const [browseResult, soldResult] = await Promise.all([
    getEbaySoldPrice(title, token),
    getEbaySoldPrice_Finding(title),
  ]);

  if (browseResult && soldResult) {
    // Both sources: weight sold 60%, BIN 40%
    const combined = soldResult.fairValue * 0.60 + browseResult.fairValue * 0.40;
    const fairValue = Math.round(combined * 100) / 100;
    console.log(`    Combined: £${soldResult.fairValue} (sold) + £${browseResult.fairValue} (BIN) = £${fairValue}`);
    return {
      fairValue,
      confidence: browseResult.confidence === "HIGH" && soldResult.confidence === "HIGH" ? "HIGH" : "MEDIUM",
      sampleSize: browseResult.sampleSize + soldResult.sampleSize,
      source: "ebay_browse+sold",
      freshness: new Date().toISOString(),
    };
  }
  if (soldResult) return soldResult;
  if (browseResult) return browseResult;
  return null;
}

// ─── DEAL SCORE (0-100) ────────────────────────────────────────────────────────
function computeDealScore(buy, rrp, ebayResult, holdData) {
  let score = 30;
  const market = ebayResult?.fairValue || getMarket("") || null;
  if (!market || !buy) return score;

  const fvf = market * EF + FEE_FIXED;
  const net = market - buy - fvf - POST;
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
  { q:"pokemon evolving skies booster box sealed",               type:"Booster Box",    marketMin:190, marketMax:260 },
  { q:"pokemon evolving skies elite trainer box sealed",         type:"ETB",            marketMin:100, marketMax:190 },
  { q:"pokemon hidden fates booster box sealed",                 type:"Booster Box",    marketMin:200, marketMax:320 },
  { q:"pokemon shining fates elite trainer box sealed",          type:"ETB",            marketMin:80,  marketMax:150 },
  { q:"pokemon prismatic evolutions elite trainer box sealed",   type:"ETB",            marketMin:60,  marketMax:110 },
  { q:"pokemon brilliant stars elite trainer box sealed",        type:"ETB",            marketMin:120, marketMax:175 },
  { q:"pokemon chilling reign booster box sealed",               type:"Booster Box",    marketMin:220, marketMax:290 },
  { q:"pokemon chilling reign elite trainer box sealed",         type:"ETB",            marketMin:100, marketMax:140 },
  { q:"pokemon silver tempest elite trainer box sealed",         type:"ETB",            marketMin:90,  marketMax:130 },
  { q:"pokemon surging sparks booster box sealed",               type:"Booster Box",    marketMin:200, marketMax:310 },
  { q:"pokemon surging sparks elite trainer box sealed",         type:"ETB",            marketMin:55,  marketMax:90  },
  { q:"pokemon 151 booster bundle sealed",                       type:"Booster Bundle", marketMin:40,  marketMax:85  },
  { q:"pokemon 151 elite trainer box sealed",                    type:"ETB",            marketMin:55,  marketMax:90  },
  { q:"pokemon destined rivals booster box sealed",              type:"Booster Box",    marketMin:110, marketMax:155 },
  { q:"pokemon champions path elite trainer box sealed",         type:"ETB",            marketMin:200, marketMax:380 },
  { q:"pokemon crown zenith elite trainer box sealed",           type:"ETB",            marketMin:95,  marketMax:135 },
  { q:"pokemon cosmic eclipse booster box sealed",               type:"Booster Box",    marketMin:250, marketMax:480 },
  { q:"pokemon celebrations elite trainer box sealed",           type:"ETB",            marketMin:60,  marketMax:130 },
  { q:"pokemon battle styles booster box sealed",                type:"Booster Box",    marketMin:250, marketMax:320 },
  { q:"pokemon fusion strike booster box sealed",                type:"Booster Box",    marketMin:190, marketMax:240 },
];

const EBAY_MIN_DISCOUNT_PCT = 8;

async function scanEbayForDeals(token) {
  if (!token) { console.log("  ⚠️ No eBay token — skipping eBay deal scan"); return []; }
  console.log("\n🛒 Scanning eBay UK for live deals...");
  const deals = [];
  const junk = ["lot "," lot","x2 ","x3 ","x4 ","x5 ","x10 ","sealed (2)","sealed(2)",
                "case of","rip seal","damaged","opened","korean","japanese","[jp]",
                "bundle of","graded","psa","bgs","twin pack","double pack"];

  for (const target of EBAY_SEARCH_TARGETS) {
    try {
      const params = new URLSearchParams({
        q: target.q,
        filter: "buyingOptions:{FIXED_PRICE},itemLocationCountry:GB,currency:GBP",
        sort: "price",
        limit: "20",
      });

      const res = await fetch(`${EBAY_BROWSE_URL}/item_summary/search?${params}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
          "Accept": "application/json",
        },
      });

      if (!res.ok) continue;
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
    collections:["/products","/collections/pokemon-sealed-products"] },
  { name:"Titan Cards",         base:"https://titancards.co.uk",              type:"shopify-json",
    collections:["/products","/collections/pokemon-sealed","/collections/pokemon"] },
  { name:"Eterna Cards",        base:"https://eternacards.co.uk",             type:"shopify-json",
    collections:["/products","/collections/pokemon-tcg-sealed-products","/collections/pokemon"] },
  { name:"Double Sleeved",      base:"https://www.doublesleeved.co.uk",       type:"shopify-json",
    collections:["/products","/collections/pokemon-sealed","/collections/pokemon"] },
  { name:"My TCG",              base:"https://www.mytcg.co.uk",               type:"shopify-json",
    collections:["/products","/collections/pokemon-sealed-product","/collections/pokemon"] },
  { name:"Zatu Games",          base:"https://www.zatugames.com",             type:"shopify-json",
    collections:["/products","/collections/pokemon-sealed-product","/collections/pokemon"] },
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
    collections:["/products","/collections/pokemon-tcg-sealed-products","/collections/pokemon"] },
  { name:"Pulse Collective",    base:"https://www.pulsecollective.co.uk",     type:"shopify-json",
    collections:["/products","/collections/pokemon","/collections/all"] },
  // ── Variable retailers (403/slower but worth trying) ──────────────────────
  { name:"Chaos Cards",         base:"https://www.chaoscards.co.uk",          type:"shopify-json",
    collections:["/collections/pokemon","/collections/tcg-pokemon"] },
  { name:"Leisure Games",       base:"https://www.leisuregames.com",          type:"shopify-json",
    collections:["/products","/collections/pokemon","/collections/trading-card-games"] },
  { name:"Minted TCG",          base:"https://www.mintedtcg.co.uk",           type:"shopify-json",
    collections:["/products","/collections/pokemon-sealed","/collections/pokemon"] },
  { name:"Goblin Gaming",       base:"https://www.goblingaming.co.uk",        type:"shopify-json",
    collections:["/products","/collections/pokemon"] },
  { name:"Magic Madhouse",      base:"https://www.magicmadhouse.co.uk",       type:"shopify-json",
    collections:["/products","/collections/pokemon","/collections/all"] },
  { name:"PACKRAT",             base:"https://packrat.co.uk",                 type:"shopify-json",
    collections:["/products","/collections/all","/collections/pokemon"] },
  { name:"Emerald Collectables", base:"https://www.emeraldcollectables.co.uk", type:"shopify-json",
    collections:["/products","/collections/pokemon-sealed","/collections/pokemon"] },
  { name:"Pokemon Center UK",   base:"https://www.pokemoncenter.com",         type:"shopify-json",
    collections:["/collections/trading-card-game-sealed","/collections/cards"] },
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
          timeout: 8000,
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

  for (const retailer of retailers) {
    if (retailer.type === "skip") continue;
    console.log(`  → ${retailer.name}`);
    try {
      const items = await scrapeRetailer(retailer);
      console.log(`    ${items.length} products fetched`);

      for (const item of items) {
        const key = `${retailer.name}::${item.title.toLowerCase().trim()}`;
        const old = seenPrices.get(key);
        const isNew = !old;
        const isPriceDrop = old && item.price < old.price * 0.95;

        if (isNew || isPriceDrop) {
          console.log(`    🟢 "${item.title}" £${item.price}`);
          findings.push({ ...item, isPriceDrop, oldPrice: old?.price || null });
          seenPrices.set(key, { price: item.price });
        }
      }
    } catch (e) {
      console.log(`    Error: ${e.message}`);
    }
    await delay(400);
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
      console.log("\n📡 Enriching deals with eBay market data...");

      const enriched = [];
      for (const f of found) {
        const rrp      = getRRP(f.title);
        const holdData = getHoldData(f.title);
        // Use combined pricing: Finding API (sold) + Browse API (BIN)
        const ebayResult = await getCombinedPrice(f.title, ebayToken);
        await delay(400);

        const resellFromMarket = getMarket(f.title);
        const resell = ebayResult?.fairValue || resellFromMarket || null;
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

      // Scan eBay for live deal listings (separate tab)
      const ebayDeals = await scanEbayForDeals(ebayToken);
      if (ebayDeals.length > 0) {
        await saveToGitHub("ebay_deals.json", {
          deals: ebayDeals,
          updatedAt: new Date().toISOString(),
          count: ebayDeals.length,
        });
      } else {
        console.log("  ℹ️ No eBay deals found this scan");
      }
    }
  } catch (e) {
    console.error("Fatal:", e.message);
    process.exit(1);
  }
  console.log("\n✅ Done.");
  process.exit(0);
})();
