const cheerio = require("cheerio");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ─── RRP TABLE ─────────────────────────────────────────────────────────────
const RRP = {
  "booster box": 144.99,
  "half booster box": 74.99,
  "half box": 74.99,
  "elite trainer box": 49.99,
  "etb": 49.99,
  "booster bundle": 24.99,
  "booster pack": 4.49,
  "mini tins": 44.99,
  "collection box": 34.99,
  "poster collection": 19.99,
  "build and battle": 24.99,
  "pin collection": 34.99,
  "deluxe pin collection": 34.99,
  "premier deck": 49.99,
  "ultra premium collection": 119.99,
  "upc": 119.99,
  "league battle deck": 39.99,
  "tin": 24.99,
  "blister": 12.99,
};

// ─── MARKET PRICES (eBay UK SOLD listings) ─────────────────────────────────
const MARKET = {
  "ascended heroes elite trainer box": 62,
  "ascended heroes etb": 62,
  "ascended heroes booster bundle": 35,
  "ascended heroes half booster box": 90,
  "ascended heroes half box": 90,
  "ascended heroes booster pack": 6.00,
  "destined rivals booster box": 125,
  "destined rivals elite trainer box": 55,
  "destined rivals booster bundle": 30,
  "destined rivals half booster box": 75,
  "destined rivals half box": 75,
  "destined rivals booster pack": 5.00,
  "perfect order booster box": 155,
  "perfect order elite trainer box": 58,
  "chaos rising booster box": 185,
  "chaos rising elite trainer box": 68,
  "phantasmal flames booster box": 270,
  "phantasmal flames elite trainer box": 85,
  "phantasmal flames booster pack": 11.00,
  "journey together booster box": 115,
  "journey together elite trainer box": 50,
  "journey together booster bundle": 26,
  "journey together half booster box": 65,
  "journey together half box": 65,
  "journey together booster pack": 4.80,
  "prismatic evolutions booster box": 215,
  "prismatic evolutions booster bundle": 85,
  "prismatic evolutions elite trainer box": 90,
  "prismatic evolutions booster pack": 17.00,
  "surging sparks booster box": 150,
  "surging sparks elite trainer box": 58,
  "surging sparks booster bundle": 32,
  "surging sparks booster pack": 6.00,
  "stellar crown booster box": 185,
  "stellar crown elite trainer box": 62,
  "shrouded fable booster box": 105,
  "twilight masquerade booster box": 125,
  "twilight masquerade elite trainer box": 52,
  "temporal forces booster box": 110,
  "temporal forces elite trainer box": 50,
  "temporal forces half booster box": 62,
  "temporal forces half box": 62,
  "paradox rift booster box": 115,
  "paradox rift elite trainer box": 52,
  "paradox rift half booster box": 65,
  "paradox rift half box": 65,
  "paradox rift booster pack": 4.80,
  "obsidian flames booster box": 125,
  "obsidian flames elite trainer box": 55,
  "paldea evolved booster box": 95,
  "paldean fates booster box": 135,
  "scarlet violet booster box": 105,
  "151 booster box": 175,
  "151 booster bundle": 52,
  "151 elite trainer box": 68,
  "151 booster pack": 7.50,
  "crown zenith booster box": 135,
  "crown zenith elite trainer box": 62,
  "silver tempest booster box": 120,
  "lost origin booster box": 125,
  "astral radiance booster box": 125,
  "brilliant stars booster box": 145,
  "brilliant stars elite trainer box": 58,
  "fusion strike booster box": 140,
  "fusion strike elite trainer box": 52,
  "evolving skies booster box": 790,
  "evolving skies elite trainer box": 175,
  "evolving skies booster pack": 27.00,
  "chilling reign booster box": 155,
  "battle styles booster box": 175,
  "shining fates booster box": 245,
  "shining fates elite trainer box": 115,
  "vivid voltage booster box": 145,
  "darkness ablaze booster box": 135,
  "rebel clash booster box": 125,
  "hidden fates booster box": 390,
  "hidden fates elite trainer box": 115,
  "hidden fates booster pack": 14.00,
  "cosmic eclipse booster box": 340,
  "champions path elite trainer box": 195,
  "unified minds booster box": 245,
  "unbroken bonds booster box": 275,
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
  "booster box", "elite trainer box", "etb", "half booster box", "half box",
  "booster bundle", "booster pack", "collection box", "poster collection",
  "build and battle", "build & battle", "pin collection", "deluxe pin collection",
  "premier deck", "ultra premium collection", "league battle deck",
  "tin", "blister", "mini tins",
];

// ─── HARD BLOCK ────────────────────────────────────────────────────────────
const BLOCK = [
  // Other languages
  "korean", "japanese", "simplified chinese", "traditional chinese",
  "gem pack", "sv3a", "sv4a", "sv5k", "sv6a", "sv7", "sv8", "sv9",
  // Other games
  "yugioh", "yu-gi-oh", "magic the gathering", "mtg", "digimon",
  "one piece", "dragon ball", "lorcana", "cardfight", "vanguard",
  "weiss", "buddyfight", "gundam", "naruto", "flesh and blood",
  // Not a product
  "code card", "online code", "live code", "single", "graded",
  "psa", "bgs", "cgc", "lot of", "proxy", "fake",
  "sleeve", "playmat", "binder", "dice", "bulk", "funko", "plush",
  "etb case", "booster box case", "case of",
  "korean booster", "japanese booster", "japanese pokemon",
  "glory of team rocket", "ruler of the black flame", "gem pack",
  "ninja spinner", "mega dream ex", "chinese", "sv3a", "sv4a", "sv5k",
  "terastal", "wild force", "cyber judge", "clay burst",
  "union arena", "grand archive", "star wars unlimited",
  "sleeve", "sleeves", "plush", "figure", "toy", "coin",
  "sealed case", "booster case", "display case",
];

// ─── PRICE SANITY LIMITS PER PRODUCT TYPE ─────────────────────────────────
const PRICE_LIMITS = {
  "booster pack": { min: 1, max: 50 },
  "booster box": { min: 30, max: 1500 },
  "half box": { min: 20, max: 400 },
  "half booster box": { min: 20, max: 400 },
  "elite trainer box": { min: 20, max: 400 },
  "etb": { min: 20, max: 400 },
  "booster bundle": { min: 10, max: 200 },
  "tin": { min: 5, max: 100 },
  "default": { min: 1, max: 1500 },
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
  if (!t.includes("pokemon")) return false;
  if (BLOCK.some(k => t.includes(k))) return false;
  if (!PRODUCT_TYPES.some(k => t.includes(k))) return false;
  if (!ENGLISH_SETS.some(s => t.includes(s))) return false;
  const limits = getPriceLimits(title);
  if (price < limits.min || price > limits.max) return false;
  return true;
}

function getRRP(title) {
  const t = title.toLowerCase();
  const sorted = Object.entries(RRP).sort((a, b) => b[0].length - a[0].length);
  for (const [k, v] of sorted) if (t.includes(k)) return v;
  return null;
}

function getMarket(title) {
  const t = title.toLowerCase();
  const sorted = Object.entries(MARKET).sort((a, b) => b[0].length - a[0].length);
  for (const [k, v] of sorted) if (t.includes(k)) return v;
  return null;
}

function getDealRating(buy, rrp, market) {
  // Rate vs MARKET price primarily
  if (market) {
    const d = ((buy - market) / market) * 100;
    if (d <= -20) return { label: "🔥 EXCELLENT DEAL", stars: "⭐⭐⭐⭐⭐" };
    if (d <= -10) return { label: "✅ GOOD DEAL", stars: "⭐⭐⭐⭐" };
    if (d <= 0)   return { label: "⚖️ AT MARKET", stars: "⭐⭐⭐" };
    if (d <= 15)  return { label: "⚠️ ABOVE MARKET", stars: "⭐⭐" };
    return { label: "❌ OVERPRICED", stars: "⭐" };
  }
  // Fallback to RRP
  if (rrp) {
    const d = ((buy - rrp) / rrp) * 100;
    if (d <= -15) return { label: "🔥 EXCELLENT DEAL", stars: "⭐⭐⭐⭐⭐" };
    if (d <= -5)  return { label: "✅ GOOD DEAL", stars: "⭐⭐⭐⭐" };
    if (d <= 5)   return { label: "⚖️ FAIR PRICE", stars: "⭐⭐⭐" };
    if (d <= 20)  return { label: "⚠️ SLIGHTLY OVERPRICED", stars: "⭐⭐" };
    return { label: "❌ OVERPRICED", stars: "⭐" };
  }
  return { label: "📦 IN STOCK", stars: "" };
}

async function fetchPage(url, ms = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
        "Cache-Control": "no-cache",
        "Referer": "https://www.google.com/",
      }
    });
    clearTimeout(timer);
    if (!res.ok) { console.log(`    HTTP ${res.status} — skipping`); return null; }
    return await res.text();
  } catch (e) {
    clearTimeout(timer);
    console.log(`    Error: ${e.message.slice(0, 60)}`);
    return null;
  }
}

function parseShopify(html, baseUrl) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const items = [];

  // Try all common Shopify product grid selectors
  const containers = [
    ".product-item", ".product-card", ".grid__item",
    ".card-wrapper", ".productitem", ".collection-product-card",
    "[data-product-id]", "li.product-item",
  ];

  for (const sel of containers) {
    if ($(sel).length === 0) continue;

    $(sel).each((_, el) => {
      // Title — multiple fallbacks
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

      // Price — extract first £X.XX from text
      const rawText = $(el).text();
      const priceMatch = rawText.match(/£\s*([\d,]+\.?\d{0,2})/);
      if (!priceMatch) return;
      const price = parseFloat(priceMatch[1].replace(/,/g, ""));
      if (!price || price <= 0) return;

      // Image URL
      let imageUrl = "";
      const img = $(el).find("img").first();
      const src = img.attr("src") || img.attr("data-src") || img.attr("data-srcset") || "";
      if (src) {
        const cleanSrc = src.split(" ")[0];
        imageUrl = cleanSrc.startsWith("//") ? `https:${cleanSrc}` :
                   cleanSrc.startsWith("http") ? cleanSrc : `${baseUrl}${cleanSrc}`;
      }

      // Sold out check
      const lower = rawText.toLowerCase();
      const soldOut = lower.includes("sold out") || lower.includes("out of stock") ||
        $(el).find(".sold-out, [class*='sold-out']").length > 0;
      if (soldOut) return;

      // Product URL
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
  return items;
}

// Core search terms — covers all product types and all sets
const CORE_SEARCHES = [
  // Product types
  "pokemon+booster+box",
  "pokemon+elite+trainer+box",
  "pokemon+booster+bundle",
  "pokemon+booster+pack",
  "pokemon+half+booster+box",
  "pokemon+tin",
  "pokemon+collection+box",
  "pokemon+poster+collection",
  "pokemon+blister",
  // Newest sets explicitly
  "pokemon+ascended+heroes",
  "pokemon+destined+rivals",
  "pokemon+perfect+order",
  "pokemon+chaos+rising",
  "pokemon+phantasmal+flames",
  "pokemon+journey+together",
  "pokemon+prismatic+evolutions",
  "pokemon+surging+sparks",
  "pokemon+stellar+crown",
  "pokemon+shrouded+fable",
  "pokemon+twilight+masquerade",
  "pokemon+temporal+forces",
  "pokemon+paradox+rift",
  "pokemon+obsidian+flames",
  "pokemon+151",
  "pokemon+paldean+fates",
  "pokemon+crown+zenith",
  "pokemon+silver+tempest",
  "pokemon+lost+origin",
  "pokemon+brilliant+stars",
  "pokemon+fusion+strike",
  "pokemon+evolving+skies",
  "pokemon+chilling+reign",
  "pokemon+battle+styles",
  "pokemon+shining+fates",
  "pokemon+vivid+voltage",
  "pokemon+hidden+fates",
  "pokemon+cosmic+eclipse",
];

function shopifyUrls(base) {
  return CORE_SEARCHES.map(q => `https://${base}/search?q=${q}&type=product`);
}

const RETAILERS = [
  { name: "Total Cards",    base: "https://totalcards.net",          urls: shopifyUrls("totalcards.net") },
  { name: "Titan Cards",    base: "https://titancards.co.uk",        urls: shopifyUrls("titancards.co.uk") },
  { name: "Eterna Cards",   base: "https://eternacards.co.uk",       urls: shopifyUrls("eternacards.co.uk") },
  { name: "PACKRAT",        base: "https://packratt.co.uk",          urls: shopifyUrls("packratt.co.uk") },
  { name: "Double Sleeved", base: "https://doublesleeved.co.uk",     urls: shopifyUrls("doublesleeved.co.uk") },
  { name: "Toys N Geek",    base: "https://www.toysngeek.co.uk",     urls: shopifyUrls("www.toysngeek.co.uk") },
  { name: "The Card Vault", base: "https://thecardvault.co.uk",      urls: shopifyUrls("thecardvault.co.uk") },
  { name: "My TCG",         base: "https://mytcg.co.uk",             urls: shopifyUrls("mytcg.co.uk") },
  { name: "Gathering Games",base: "https://gatheringgames.co.uk",    urls: shopifyUrls("gatheringgames.co.uk") },
  {
    name: "Magic Madhouse", base: "https://magicmadhouse.co.uk",
    urls: CORE_SEARCHES.map(q => `https://magicmadhouse.co.uk/search?q=${q}`),
  },
  {
    name: "Zatu Games", base: "https://www.board-game.co.uk",
    urls: CORE_SEARCHES.map(q => `https://www.board-game.co.uk/search?q=${q}`),
  },
  {
    name: "365 Games", base: "https://www.365games.co.uk",
    urls: CORE_SEARCHES.map(q => `https://www.365games.co.uk/search?q=${q}`),
  },
  {
    name: "Smyths", base: "https://www.smythstoys.com",
    urls: [
      "https://www.smythstoys.com/uk/en-gb/search/?text=pokemon+booster+box",
      "https://www.smythstoys.com/uk/en-gb/search/?text=pokemon+elite+trainer+box",
      "https://www.smythstoys.com/uk/en-gb/search/?text=pokemon+ascended+heroes",
      "https://www.smythstoys.com/uk/en-gb/search/?text=pokemon+destined+rivals",
      "https://www.smythstoys.com/uk/en-gb/search/?text=pokemon+booster+bundle",
    ],
  },
  {
    name: "Argos", base: "https://www.argos.co.uk",
    urls: [
      "https://www.argos.co.uk/search/pokemon-booster-box/",
      "https://www.argos.co.uk/search/pokemon-elite-trainer-box/",
      "https://www.argos.co.uk/search/pokemon-trading-cards/",
    ],
  },
  {
    name: "GAME", base: "https://www.game.co.uk",
    urls: [
      "https://www.game.co.uk/search?q=pokemon+booster+box",
      "https://www.game.co.uk/search?q=pokemon+elite+trainer+box",
      "https://www.game.co.uk/search?q=pokemon+ascended+heroes",
      "https://www.game.co.uk/search?q=pokemon+destined+rivals",
    ],
  },
  {
    name: "Amazon UK", base: "https://www.amazon.co.uk",
    urls: [
      "https://www.amazon.co.uk/s?k=pokemon+booster+box+scarlet+violet&rh=p_85%3A1",
      "https://www.amazon.co.uk/s?k=pokemon+ascended+heroes&rh=p_85%3A1",
      "https://www.amazon.co.uk/s?k=pokemon+destined+rivals&rh=p_85%3A1",
      "https://www.amazon.co.uk/s?k=pokemon+elite+trainer+box&rh=p_85%3A1",
      "https://www.amazon.co.uk/s?k=pokemon+evolving+skies+booster+box&rh=p_85%3A1",
    ],
  },
];

const notified = new Set();

async function sendPhoto(imageUrl, caption) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        photo: imageUrl,
        caption,
        parse_mode: "HTML",
      }),
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
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
    });
    const d = await res.json();
    if (d.ok) console.log("    📱 Message sent!");
    else console.log("    ❌ Message error:", d.description);
  } catch (e) {
    console.log("    ❌ Message error:", e.message);
  }
}

async function sendAlert(f) {
  const rrp = getRRP(f.title);
  const market = getMarket(f.title);
  const { label, stars } = getDealRating(f.price, rrp, market);

  const vsRrp = rrp ? Math.round(((f.price - rrp) / rrp) * 100) : null;
  const vsMarket = market ? Math.round(((f.price - market) / market) * 100) : null;
  const flip = market ? (market - f.price - (market * 0.13) - 4.00) : null;
  const flipPct = flip && f.price ? Math.round((flip / f.price) * 100) : null;
  const perPack = f.title.toLowerCase().includes("booster box") && !f.title.toLowerCase().includes("half") ?
    (f.price / 36).toFixed(2) :
    f.title.toLowerCase().includes("half") ? (f.price / 18).toFixed(2) : null;

  const lines = [
    `${label} ${stars}`,
    ``,
    `<b>${f.title}</b>`,
    `🏪 <b>${f.retailer}</b>`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━`,
    `💰 <b>BUY NOW:   £${f.price.toFixed(2)}</b>`,
  ];

  if (rrp) lines.push(`📊 RRP:       £${rrp.toFixed(2)}  <b>(${vsRrp > 0 ? "+" : ""}${vsRrp}%)</b>`);
  if (market) lines.push(`📈 MARKET:    £${market.toFixed(2)}  <b>(${vsMarket > 0 ? "+" : ""}${vsMarket}%)</b>`);
  if (perPack) lines.push(`🃏 PER PACK:  £${perPack}`);

  if (flip !== null) {
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`🏷️ FLIP PROFIT: <b>${flip > 0 ? "+" : ""}£${flip.toFixed(2)} (${flipPct > 0 ? "+" : ""}${flipPct}% ROI)</b>`);
    lines.push(`📉 eBay fees: -£${(market * 0.13).toFixed(2)} + £4 postage`);
    if (flip > 0) {
      lines.push(`✅ <b>PROFITABLE TO FLIP</b>`);
    } else {
      lines.push(`⚠️ Not profitable to flip at this price`);
    }
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`<a href="${f.url}">👉 BUY NOW →</a>`);

  const caption = lines.join("\n");

  // Send with photo if we have an image, otherwise plain message
  if (f.image && f.image.startsWith("http")) {
    const sent = await sendPhoto(f.image, caption);
    if (!sent) await sendMessage(caption);
  } else {
    await sendMessage(caption);
  }
}

async function runScan() {
  console.log(`\n🔍 ${RETAILERS.length} retailers · ${new Date().toLocaleTimeString("en-GB")}`);
  const findings = [];

  for (const retailer of RETAILERS) {
    console.log(`  → ${retailer.name}`);

    for (const url of retailer.urls) {
      await new Promise(r => setTimeout(r, 500)); // 0.5s between requests
      const html = await fetchPage(url);
      if (!html) continue;

      const items = parseShopify(html, retailer.base);
      const term = url.split("q=")[1]?.split("&")[0] || "";
      console.log(`    [${term}] ${items.length} items parsed`);

      for (const item of items) {
        if (!isValidProduct(item.title, item.price)) continue;

        const key = `${retailer.name}::${item.title.toLowerCase().trim()}`;
        if (!notified.has(key)) {
          notified.add(key);
          findings.push({ ...item, retailer: retailer.name });
          console.log(`    🟢 "${item.title}" £${item.price}`);
        }
      }
    }
  }

  console.log(`\n📊 ${findings.length} new confirmed deals`);

  for (const f of findings) {
    await sendAlert(f);
    await new Promise(r => setTimeout(r, 800));
  }

  if (findings.length === 0) console.log("  ⬜ Nothing new this scan.");
}

console.log("🚀 Lock3y's PokéScraper — Full Coverage");
console.log("🇬🇧 English sealed products only · All expansions");
console.log("📸 Images + full deal intelligence in every alert\n");

runScan()
  .then(() => { console.log("\n✅ Done."); process.exit(0); })
  .catch(e => { console.error("Fatal:", e.message); process.exit(1); });
