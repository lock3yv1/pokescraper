const cheerio = require("cheerio");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ─── RRP TABLE ─────────────────────────────────────────────────────────────
const RRP = {
  "booster box": 144.99,
  "elite trainer box": 49.99,
  "etb": 49.99,
  "half box": 74.99,
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
  "check lane blister": 12.99,
  "3 pack blister": 14.99,
  "display box": 299.99,
};

// ─── RESELL TABLE (eBay UK current sold prices) ────────────────────────────
const RESELL = {
  // Mega Evolution era
  "ascended heroes elite trainer box": 65,
  "ascended heroes etb": 65,
  "ascended heroes booster bundle": 38,
  "ascended heroes half box": 95,
  "ascended heroes booster pack": 6.50,
  "ascended heroes collection box": 45,
  "destined rivals booster box": 130,
  "destined rivals elite trainer box": 58,
  "destined rivals booster bundle": 32,
  "destined rivals half box": 80,
  "destined rivals booster pack": 5.50,
  "perfect order booster box": 160,
  "perfect order elite trainer box": 60,
  "perfect order booster pack": 7.00,
  "chaos rising booster box": 190,
  "chaos rising elite trainer box": 70,
  "chaos rising booster pack": 8.00,
  "phantasmal flames booster box": 280,
  "phantasmal flames elite trainer box": 90,
  "phantasmal flames booster pack": 12.00,
  // Scarlet & Violet
  "journey together booster box": 120,
  "journey together elite trainer box": 52,
  "journey together booster bundle": 28,
  "journey together booster pack": 5.00,
  "prismatic evolutions booster box": 220,
  "prismatic evolutions booster bundle": 90,
  "prismatic evolutions elite trainer box": 95,
  "prismatic evolutions booster pack": 18.00,
  "surging sparks booster box": 155,
  "surging sparks elite trainer box": 60,
  "surging sparks booster bundle": 35,
  "surging sparks booster pack": 6.50,
  "stellar crown booster box": 190,
  "stellar crown elite trainer box": 65,
  "stellar crown booster pack": 7.50,
  "shrouded fable booster box": 110,
  "shrouded fable booster pack": 5.00,
  "twilight masquerade booster box": 130,
  "twilight masquerade elite trainer box": 55,
  "twilight masquerade booster pack": 5.50,
  "temporal forces booster box": 115,
  "temporal forces elite trainer box": 52,
  "temporal forces booster pack": 5.00,
  "paradox rift booster box": 120,
  "paradox rift elite trainer box": 55,
  "paradox rift booster pack": 5.00,
  "obsidian flames booster box": 130,
  "obsidian flames elite trainer box": 58,
  "obsidian flames booster pack": 5.50,
  "paldea evolved booster box": 100,
  "paldea evolved booster pack": 4.50,
  "paldean fates booster box": 140,
  "paldean fates booster pack": 6.00,
  "scarlet violet booster box": 110,
  "scarlet violet booster pack": 5.00,
  "151 booster box": 180,
  "151 booster bundle": 55,
  "151 elite trainer box": 70,
  "151 booster pack": 8.00,
  // Sword & Shield
  "crown zenith booster box": 140,
  "crown zenith elite trainer box": 65,
  "crown zenith booster pack": 5.50,
  "silver tempest booster box": 125,
  "silver tempest booster pack": 5.00,
  "lost origin booster box": 130,
  "lost origin booster pack": 5.50,
  "pokemon go booster box": 180,
  "pokemon go booster pack": 7.00,
  "astral radiance booster box": 130,
  "astral radiance booster pack": 5.50,
  "brilliant stars booster box": 150,
  "brilliant stars booster pack": 6.00,
  "brilliant stars elite trainer box": 60,
  "fusion strike booster box": 145,
  "fusion strike booster pack": 5.50,
  "fusion strike elite trainer box": 55,
  "evolving skies booster box": 800,
  "evolving skies elite trainer box": 180,
  "evolving skies booster pack": 28.00,
  "chilling reign booster box": 160,
  "chilling reign booster pack": 6.50,
  "chilling reign elite trainer box": 65,
  "battle styles booster box": 180,
  "battle styles booster pack": 7.00,
  "shining fates booster box": 250,
  "shining fates elite trainer box": 120,
  "shining fates booster pack": 10.00,
  "vivid voltage booster box": 150,
  "vivid voltage booster pack": 6.00,
  "champions path elite trainer box": 200,
  "darkness ablaze booster box": 140,
  "darkness ablaze booster pack": 5.50,
  "rebel clash booster box": 130,
  "rebel clash booster pack": 5.00,
  "sword shield base booster box": 200,
  "sword shield base booster pack": 8.00,
  // Older sets
  "hidden fates booster box": 400,
  "hidden fates elite trainer box": 120,
  "hidden fates booster pack": 15.00,
  "cosmic eclipse booster box": 350,
  "cosmic eclipse booster pack": 14.00,
  "unified minds booster box": 250,
  "unbroken bonds booster box": 280,
  "team up booster box": 220,
  "lost thunder booster box": 250,
  "dragon majesty booster box": 300,
  "celestial storm booster box": 200,
  "forbidden light booster box": 180,
  "ultra prism booster box": 200,
  "burning shadows booster box": 200,
  "guardians rising booster box": 220,
  "sun moon base booster box": 250,
};

// ─── PRODUCT TYPE KEYWORDS ─────────────────────────────────────────────────
const PRODUCT_KEYWORDS = [
  "booster box", "elite trainer box", "etb", "half box",
  "booster bundle", "booster pack", "collection box",
  "poster collection", "build and battle", "build & battle",
  "pin collection", "deluxe pin collection", "premier deck",
  "display box", "mini tins", "ultra premium collection", "upc",
  "league battle deck", "tin", "blister", "check lane",
  "3 pack", "three pack",
];

// ─── EXCLUDE KEYWORDS ─────────────────────────────────────────────────────
const EXCLUDE = [
  "yugioh", "yu-gi-oh", "magic the gathering", "mtg", "digimon",
  "one piece", "dragon ball", "lorcana", "flesh and blood",
  "cardfight", "vanguard", "weiss", "buddyfight", "gundam",
  "star wars", "marvel", "naruto", "disney", "fortnite",
  "graded", "psa", "bgs", "cgc", "beckett",
  "lot of", "proxy", "fake", "replica", "custom",
  "sleeve", "sleeves", "playmat", "binder", "dice",
  "coin", "energy cards", "card lot", "bulk", "common",
  "funko", "plush", "figure", "toy", "action figure",
  "single card", "holo card", "ex card", "gx card",
];

// ─── ALL POKEMON SETS ──────────────────────────────────────────────────────
const SETS = [
  // Mega Evolution era
  "ascended heroes", "destined rivals", "perfect order",
  "chaos rising", "phantasmal flames",
  // Scarlet & Violet
  "journey together", "prismatic evolutions", "surging sparks",
  "stellar crown", "shrouded fable", "twilight masquerade",
  "temporal forces", "paradox rift", "obsidian flames",
  "paldea evolved", "paldean fates", "scarlet & violet",
  "scarlet and violet", "scarlet violet", "151",
  // Sword & Shield
  "crown zenith", "silver tempest", "lost origin", "pokemon go",
  "astral radiance", "brilliant stars", "fusion strike",
  "evolving skies", "chilling reign", "battle styles",
  "shining fates", "vivid voltage", "champions path",
  "darkness ablaze", "rebel clash", "sword & shield",
  "sword and shield",
  // Sun & Moon
  "hidden fates", "cosmic eclipse", "unified minds",
  "unbroken bonds", "team up", "lost thunder",
  "dragon majesty", "celestial storm", "forbidden light",
  "ultra prism", "burning shadows", "guardians rising",
  "sun & moon", "sun and moon",
];

function isValidProduct(title) {
  const t = title.toLowerCase();
  if (!t.includes("pokemon")) return false;
  if (EXCLUDE.some(k => t.includes(k))) return false;
  if (!PRODUCT_KEYWORDS.some(k => t.includes(k))) return false;
  return true; // Don't filter by set — catch everything Pokemon
}

function getRRP(title) {
  const t = title.toLowerCase();
  const sorted = Object.entries(RRP).sort((a, b) => b[0].length - a[0].length);
  for (const [k, v] of sorted) if (t.includes(k)) return v;
  return null;
}

function getResell(title) {
  const t = title.toLowerCase();
  const sorted = Object.entries(RESELL).sort((a, b) => b[0].length - a[0].length);
  for (const [k, v] of sorted) if (t.includes(k)) return v;
  return null;
}

function dealScore(buy, rrp) {
  const d = ((buy - rrp) / rrp) * 100;
  if (d <= -15) return "🔥 EXCELLENT DEAL";
  if (d <= -5)  return "✅ GOOD DEAL";
  if (d <= 5)   return "⚖️ FAIR PRICE";
  if (d <= 20)  return "⚠️ SLIGHTLY OVERPRICED";
  return "❌ OVERPRICED";
}

// ─── FETCH WITH TIMEOUT ────────────────────────────────────────────────────
async function fetchPage(url, ms = 10000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
        "Cache-Control": "no-cache",
      }
    });
    clearTimeout(t);
    if (!res.ok) { console.log(`    HTTP ${res.status}`); return null; }
    return await res.text();
  } catch (e) {
    clearTimeout(t);
    console.log(`    Error: ${e.message.slice(0, 50)}`);
    return null;
  }
}

// ─── PARSE HTML FOR PRODUCTS ───────────────────────────────────────────────
function parseProducts(html, baseUrl) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const items = [];

  // Try every common product container
  const containers = [
    ".product-item", ".product-card", ".grid__item",
    ".card-wrapper", ".productitem", ".product-listing",
    "[data-product-id]", "li.boost-pfs-filter-product-item",
    ".collection-product-card", ".product",
  ];

  for (const container of containers) {
    const els = $(container);
    if (els.length === 0) continue;

    els.each((_, el) => {
      // Extract title — try multiple selectors, take first clean text result
      let title = "";
      const titleTries = [
        ".card__heading a", ".product-item__title", ".productitem--title",
        ".product-title", ".product-name", ".product-card__title",
        "h2 a", "h3 a", "h2", "h3", "h4",
        "a[aria-label]",
      ];
      for (const ts of titleTries) {
        const el2 = $(el).find(ts).first();
        const text = (el2.attr("aria-label") || el2.text()).trim();
        if (text && text.length > 5 && !text.includes("<") && !text.includes("src=")) {
          title = text;
          break;
        }
      }
      if (!title) return;

      // Extract price — find first £ amount
      const fullText = $(el).text();
      const priceMatch = fullText.match(/£\s*([\d,]+\.?\d*)/);
      if (!priceMatch) return;
      const price = parseFloat(priceMatch[1].replace(",", ""));
      if (!price || price <= 0 || price > 5000) return;

      // Check not sold out
      const soldOut = fullText.toLowerCase().includes("sold out") ||
        $(el).find(".sold-out, [class*='sold-out'], [class*='unavailable']").length > 0;
      if (soldOut) return;

      // Get URL
      const link = $(el).find("a[href*='/products/']").first().attr("href") ||
                   $(el).find("a[href]").first().attr("href");
      if (!link) return;
      const url = link.startsWith("http") ? link : `${baseUrl}${link}`;

      const key = `${title}::${price}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push({ title, price, url });
      }
    });

    if (items.length > 0) break; // Stop at first working container
  }

  return items;
}

// ─── RETAILERS ─────────────────────────────────────────────────────────────
const RETAILERS = [
  {
    name: "Total Cards",
    base: "https://totalcards.net",
    urls: [
      "https://totalcards.net/search?q=pokemon+booster+box&type=product",
      "https://totalcards.net/search?q=pokemon+elite+trainer+box&type=product",
      "https://totalcards.net/search?q=pokemon+booster+pack&type=product",
    ],
  },
  {
    name: "Titan Cards",
    base: "https://titancards.co.uk",
    urls: [
      "https://titancards.co.uk/search?q=pokemon+booster+box&type=product",
      "https://titancards.co.uk/search?q=pokemon+elite+trainer&type=product",
    ],
  },
  {
    name: "Eterna Cards",
    base: "https://eternacards.co.uk",
    urls: [
      "https://eternacards.co.uk/search?q=pokemon+booster+box&type=product",
      "https://eternacards.co.uk/search?q=pokemon+elite+trainer&type=product",
      "https://eternacards.co.uk/search?q=pokemon+booster+pack&type=product",
    ],
  },
  {
    name: "PACKRAT",
    base: "https://packratt.co.uk",
    urls: [
      "https://packratt.co.uk/search?q=pokemon+booster+box&type=product",
      "https://packratt.co.uk/search?q=pokemon+elite+trainer&type=product",
    ],
  },
  {
    name: "Big Orbit",
    base: "https://www.bigorbitcards.co.uk",
    urls: [
      "https://www.bigorbitcards.co.uk/search?q=pokemon+booster+box&type=product",
      "https://www.bigorbitcards.co.uk/search?q=pokemon+elite+trainer&type=product",
    ],
  },
  {
    name: "Double Sleeved",
    base: "https://doublesleeved.co.uk",
    urls: [
      "https://doublesleeved.co.uk/search?q=pokemon+booster+box&type=product",
      "https://doublesleeved.co.uk/search?q=pokemon+elite+trainer&type=product",
    ],
  },
  {
    name: "Toys N Geek",
    base: "https://www.toysngeek.co.uk",
    urls: [
      "https://www.toysngeek.co.uk/search?q=pokemon+booster+box&type=product",
    ],
  },
  {
    name: "The Card Vault",
    base: "https://thecardvault.co.uk",
    urls: [
      "https://thecardvault.co.uk/search?q=pokemon+booster+box&type=product",
    ],
  },
  {
    name: "My TCG",
    base: "https://mytcg.co.uk",
    urls: [
      "https://mytcg.co.uk/search?q=pokemon+booster+box&type=product",
      "https://mytcg.co.uk/search?q=pokemon+booster+pack&type=product",
    ],
  },
  {
    name: "Gathering Games",
    base: "https://gatheringgames.co.uk",
    urls: [
      "https://gatheringgames.co.uk/search?q=pokemon+booster+box&type=product",
    ],
  },
  {
    name: "Magic Madhouse",
    base: "https://magicmadhouse.co.uk",
    urls: [
      "https://magicmadhouse.co.uk/search?q=pokemon+booster+box",
      "https://magicmadhouse.co.uk/search?q=pokemon+booster+pack",
    ],
  },
  {
    name: "Chaos Cards",
    base: "https://www.chaoscards.co.uk",
    urls: [
      "https://www.chaoscards.co.uk/search?q=pokemon+booster+box",
      "https://www.chaoscards.co.uk/search?q=pokemon+booster+pack",
    ],
  },
];

const notified = new Set();

// ─── TELEGRAM ──────────────────────────────────────────────────────────────
async function sendTelegram(msg) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: msg,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
    });
    const data = await res.json();
    if (data.ok) console.log("    📱 Telegram sent!");
    else console.log("    ❌ Telegram error:", data.description);
  } catch (e) {
    console.log("    ❌ Telegram:", e.message);
  }
}

// ─── MAIN SCAN ─────────────────────────────────────────────────────────────
async function runScan() {
  console.log(`\n🔍 ${RETAILERS.length} retailers · ${new Date().toLocaleTimeString("en-GB")}`);
  const findings = [];

  for (const retailer of RETAILERS) {
    console.log(`  → ${retailer.name}`);
    const allItems = [];

    for (const url of retailer.urls) {
      await new Promise(r => setTimeout(r, 1000)); // Rate limit protection
      const html = await fetchPage(url);
      if (!html) continue;

      const items = parseProducts(html, retailer.base);
      console.log(`    ${url.split("?")[1]} → ${items.length} items`);
      if (items.length > 0) {
        console.log(`    First: "${items[0].title}" £${items[0].price}`);
      }
      allItems.push(...items);
    }

    for (const item of allItems) {
      if (!isValidProduct(item.title)) continue;

      const rrp = getRRP(item.title);
      const resell = getResell(item.title);

      // Send alert even without resell data — just won't show flip profit
      const key = `${retailer.name}::${item.url}`;
      if (!notified.has(key)) {
        notified.add(key);
        findings.push({ ...item, retailer: retailer.name, rrp, resell });
        console.log(`    🟢 ${item.title} — £${item.price}`);
      }
    }
  }

  console.log(`\n📊 ${findings.length} new confirmed deals`);

  for (const f of findings) {
    const hasRrp = f.rrp != null;
    const hasResell = f.resell != null;

    const score = hasRrp ? dealScore(f.price, f.rrp) : "📦 IN STOCK";
    const vsRrp = hasRrp ? Math.round(((f.price - f.rrp) / f.rrp) * 100) : null;
    const vsResell = hasResell ? Math.round(((f.resell - f.price) / f.price) * 100) : null;
    const flip = hasResell ? (f.resell - f.price - (f.resell * 0.13) - 4).toFixed(2) : null;

    const lines = [
      score, ``,
      `<b>${f.title}</b>`,
      `🏪 ${f.retailer}`, ``,
      `💰 BUY NOW:  £${f.price.toFixed(2)}`,
    ];

    if (hasRrp) lines.push(`📊 RRP:      £${f.rrp.toFixed(2)}  (${vsRrp > 0 ? "+" : ""}${vsRrp}% vs RRP)`);
    if (hasResell) lines.push(`📈 RESELL:   £${f.resell.toFixed(2)}  (${vsResell > 0 ? "+" : ""}${vsResell}% potential)`);
    if (flip) lines.push(`🏷️ FLIP:     ${flip > 0 ? "+" : ""}£${flip} after eBay fees`);

    lines.push(``, `<a href="${f.url}">👉 BUY NOW →</a>`);

    await sendTelegram(lines.join("\n"));
    await new Promise(r => setTimeout(r, 500));
  }

  if (findings.length === 0) console.log("  ⬜ Nothing new this scan.");
}

// ─── START ─────────────────────────────────────────────────────────────────
console.log("🚀 Lock3y's PokéScraper — Full UK Coverage");
console.log(`📦 All products: boxes, ETBs, packs, bundles, tins, blisters`);
console.log(`🎯 All expansions: Mega Evolution → Sun & Moon\n`);

runScan()
  .then(() => { console.log("\n✅ Done."); process.exit(0); })
  .catch(e => { console.error("Fatal:", e.message); process.exit(1); });
