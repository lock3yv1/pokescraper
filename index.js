const cheerio = require("cheerio");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ─── ACCURATE RRP TABLE ────────────────────────────────────────────────────
// These are OFFICIAL Pokemon UK retail prices
const RRP = {
  "booster box": 144.99,       // 36 packs
  "half booster box": 74.99,   // 18 packs
  "half box": 74.99,
  "elite trainer box": 49.99,
  "etb": 49.99,
  "booster bundle": 24.99,     // 6 packs
  "booster pack": 4.49,        // single pack
  "mini tins": 44.99,
  "collection box": 34.99,
  "poster collection": 19.99,
  "build and battle": 24.99,
  "build & battle": 24.99,
  "pin collection": 34.99,
  "deluxe pin collection": 34.99,
  "premier deck": 49.99,
  "ultra premium collection": 119.99,
  "upc": 119.99,
  "league battle deck": 39.99,
  "tin": 24.99,
  "blister": 12.99,
  "3 pack blister": 14.99,
};

// ─── RESELL PRICES (eBay UK SOLD listings - current market) ───────────────
const RESELL = {
  // Current sets - Mega Evolution era
  "ascended heroes elite trainer box": 62,
  "ascended heroes etb": 62,
  "ascended heroes booster bundle": 35,
  "ascended heroes half box": 90,
  "ascended heroes booster pack": 6.00,
  "destined rivals booster box": 125,
  "destined rivals elite trainer box": 55,
  "destined rivals booster bundle": 30,
  "destined rivals half box": 75,
  "destined rivals booster pack": 5.00,
  "perfect order booster box": 155,
  "perfect order elite trainer box": 58,
  "perfect order booster pack": 6.50,
  "chaos rising booster box": 185,
  "chaos rising elite trainer box": 68,
  "chaos rising booster pack": 7.50,
  "phantasmal flames booster box": 270,
  "phantasmal flames elite trainer box": 85,
  "phantasmal flames booster pack": 11.00,
  // Scarlet & Violet
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
  "stellar crown booster pack": 7.00,
  "shrouded fable booster box": 105,
  "shrouded fable booster pack": 4.80,
  "twilight masquerade booster box": 125,
  "twilight masquerade elite trainer box": 52,
  "twilight masquerade booster pack": 5.20,
  "temporal forces booster box": 110,
  "temporal forces elite trainer box": 50,
  "temporal forces half booster box": 62,
  "temporal forces half box": 62,
  "temporal forces booster pack": 4.80,
  "paradox rift booster box": 115,
  "paradox rift elite trainer box": 52,
  "paradox rift half booster box": 65,
  "paradox rift half box": 65,
  "paradox rift booster pack": 4.80,
  "obsidian flames booster box": 125,
  "obsidian flames elite trainer box": 55,
  "obsidian flames booster pack": 5.20,
  "paldea evolved booster box": 95,
  "paldea evolved booster pack": 4.30,
  "paldean fates booster box": 135,
  "paldean fates booster pack": 5.80,
  "scarlet violet booster box": 105,
  "scarlet violet booster pack": 4.80,
  "151 booster box": 175,
  "151 booster bundle": 52,
  "151 elite trainer box": 68,
  "151 booster pack": 7.50,
  // Sword & Shield
  "crown zenith booster box": 135,
  "crown zenith elite trainer box": 62,
  "crown zenith booster pack": 5.20,
  "silver tempest booster box": 120,
  "silver tempest booster pack": 4.80,
  "lost origin booster box": 125,
  "lost origin booster pack": 5.20,
  "astral radiance booster box": 125,
  "astral radiance booster pack": 5.20,
  "brilliant stars booster box": 145,
  "brilliant stars elite trainer box": 58,
  "brilliant stars booster pack": 5.80,
  "fusion strike booster box": 140,
  "fusion strike elite trainer box": 52,
  "fusion strike booster pack": 5.20,
  "evolving skies booster box": 790,
  "evolving skies elite trainer box": 175,
  "evolving skies booster pack": 27.00,
  "chilling reign booster box": 155,
  "chilling reign elite trainer box": 62,
  "chilling reign booster pack": 6.20,
  "battle styles booster box": 175,
  "battle styles booster pack": 6.80,
  "shining fates booster box": 245,
  "shining fates elite trainer box": 115,
  "shining fates booster pack": 9.50,
  "vivid voltage booster box": 145,
  "vivid voltage booster pack": 5.80,
  "darkness ablaze booster box": 135,
  "darkness ablaze booster pack": 5.20,
  "rebel clash booster box": 125,
  "rebel clash booster pack": 4.80,
  "sword shield booster box": 195,
  "sword & shield booster box": 195,
  // Older
  "hidden fates booster box": 390,
  "hidden fates elite trainer box": 115,
  "hidden fates booster pack": 14.00,
  "cosmic eclipse booster box": 340,
  "cosmic eclipse booster pack": 13.50,
  "unified minds booster box": 245,
  "unbroken bonds booster box": 275,
  "team up booster box": 215,
  "champions path elite trainer box": 195,
};

// ─── MUST be English sealed Pokemon product ────────────────────────────────
const PRODUCT_KEYWORDS = [
  "booster box", "elite trainer box", "etb", "half booster box", "half box",
  "booster bundle", "booster pack", "collection box", "poster collection",
  "build and battle", "build & battle", "pin collection",
  "deluxe pin collection", "premier deck", "ultra premium collection",
  "league battle deck", "tin", "blister", "mini tins",
];

// ─── BLOCK these ───────────────────────────────────────────────────────────
const EXCLUDE = [
  // Other card games
  "yugioh", "yu-gi-oh", "magic the gathering", "mtg", "digimon",
  "one piece", "dragon ball", "lorcana", "cardfight", "vanguard",
  "weiss", "buddyfight", "gundam", "naruto", "fortnite",
  // Non-English
  "korean", "japanese", "japanese pokemon", "japanese tcg",
  "simplified chinese", "traditional chinese", "sv3a", "sv4a",
  "sv5k", "sv6", "sv6a", "sv7", "sv8", "sv9",
  // Not sealed product
  "single", "graded", "psa", "bgs", "cgc", "lot of", "proxy",
  "fake", "sleeve", "playmat", "binder", "dice", "bulk", "funko",
  "plush", "figure", "card lot", "common", "uncommon",
  "holo", "reverse holo", "full art", "secret rare",
];

function isValidProduct(title) {
  const t = title.toLowerCase();
  if (!t.includes("pokemon")) return false;
  if (EXCLUDE.some(k => t.includes(k))) return false;
  if (!PRODUCT_KEYWORDS.some(k => t.includes(k))) return false;
  return true;
}

function getRRP(title) {
  const t = title.toLowerCase();
  // Match longest key first for accuracy
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

function getDealRating(buy, rrp, resell) {
  // Rate against MARKET price (resell), not just RRP
  // This is more accurate — if something sells for less than eBay it's a deal
  const vsRrp = ((buy - rrp) / rrp) * 100;
  const vsMarket = resell ? ((buy - resell) / resell) * 100 : null;

  // If it's cheaper than eBay market — that's the real deal signal
  if (vsMarket !== null && vsMarket <= -15) return "🔥 EXCELLENT DEAL";
  if (vsMarket !== null && vsMarket <= -5)  return "✅ GOOD DEAL";
  if (vsMarket !== null && vsMarket <= 5)   return "⚖️ AT MARKET PRICE";
  if (vsMarket !== null && vsMarket > 5)    return "⚠️ ABOVE MARKET";
  // Fallback to RRP comparison
  if (vsRrp <= -15) return "🔥 EXCELLENT DEAL";
  if (vsRrp <= -5)  return "✅ GOOD DEAL";
  if (vsRrp <= 5)   return "⚖️ FAIR PRICE";
  if (vsRrp <= 20)  return "⚠️ SLIGHTLY OVERPRICED";
  return "❌ OVERPRICED";
}

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

function parseProducts(html, baseUrl) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const items = [];

  const containers = [
    ".product-item", ".product-card", ".grid__item",
    ".card-wrapper", ".productitem", ".product-listing",
    "[data-product-id]", ".collection-product-card",
  ];

  for (const container of containers) {
    const els = $(container);
    if (els.length === 0) continue;

    els.each((_, el) => {
      let title = "";
      const titleTries = [
        ".card__heading a", ".product-item__title", ".productitem--title",
        ".product-title", ".product-name", ".product-card__title",
        "h2 a", "h3 a", "h2", "h3", "h4", "a[aria-label]",
      ];
      for (const ts of titleTries) {
        const found = $(el).find(ts).first();
        const text = (found.attr("aria-label") || found.text()).trim();
        if (text && text.length > 5 && !text.includes("<") && !text.includes("src=")) {
          title = text;
          break;
        }
      }
      if (!title) return;

      // Extract first £ price
      const fullText = $(el).text();
      const priceMatch = fullText.match(/£\s*([\d,]+\.?\d*)/);
      if (!priceMatch) return;
      const price = parseFloat(priceMatch[1].replace(",", ""));
      if (!price || price <= 0 || price > 5000) return;

      const soldOut = fullText.toLowerCase().includes("sold out") ||
        $(el).find(".sold-out, [class*='sold-out'], [class*='unavailable']").length > 0;
      if (soldOut) return;

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
    if (items.length > 0) break;
  }
  return items;
}

const RETAILERS = [
  {
    name: "Total Cards", base: "https://totalcards.net",
    urls: [
      "https://totalcards.net/search?q=pokemon+booster+box&type=product",
      "https://totalcards.net/search?q=pokemon+elite+trainer+box&type=product",
      "https://totalcards.net/search?q=pokemon+booster+pack&type=product",
      "https://totalcards.net/search?q=pokemon+tin&type=product",
    ],
  },
  {
    name: "Titan Cards", base: "https://titancards.co.uk",
    urls: [
      "https://titancards.co.uk/search?q=pokemon+booster+box&type=product",
      "https://titancards.co.uk/search?q=pokemon+elite+trainer+box&type=product",
      "https://titancards.co.uk/search?q=pokemon+booster+pack&type=product",
    ],
  },
  {
    name: "Eterna Cards", base: "https://eternacards.co.uk",
    urls: [
      "https://eternacards.co.uk/search?q=pokemon+booster+box&type=product",
      "https://eternacards.co.uk/search?q=pokemon+elite+trainer+box&type=product",
      "https://eternacards.co.uk/search?q=pokemon+booster+pack&type=product",
      "https://eternacards.co.uk/search?q=pokemon+half+box&type=product",
    ],
  },
  {
    name: "PACKRAT", base: "https://packratt.co.uk",
    urls: [
      "https://packratt.co.uk/search?q=pokemon+booster+box&type=product",
      "https://packratt.co.uk/search?q=pokemon+elite+trainer+box&type=product",
    ],
  },
  {
    name: "Big Orbit", base: "https://www.bigorbitcards.co.uk",
    urls: [
      "https://www.bigorbitcards.co.uk/search?q=pokemon+booster+box&type=product",
      "https://www.bigorbitcards.co.uk/search?q=pokemon+elite+trainer+box&type=product",
    ],
  },
  {
    name: "Double Sleeved", base: "https://doublesleeved.co.uk",
    urls: [
      "https://doublesleeved.co.uk/search?q=pokemon+booster+box&type=product",
      "https://doublesleeved.co.uk/search?q=pokemon+elite+trainer+box&type=product",
    ],
  },
  {
    name: "Toys N Geek", base: "https://www.toysngeek.co.uk",
    urls: [
      "https://www.toysngeek.co.uk/search?q=pokemon+booster+box&type=product",
      "https://www.toysngeek.co.uk/search?q=pokemon+elite+trainer+box&type=product",
    ],
  },
  {
    name: "The Card Vault", base: "https://thecardvault.co.uk",
    urls: [
      "https://thecardvault.co.uk/search?q=pokemon+booster+box&type=product",
      "https://thecardvault.co.uk/search?q=pokemon+booster+pack&type=product",
    ],
  },
  {
    name: "My TCG", base: "https://mytcg.co.uk",
    urls: [
      "https://mytcg.co.uk/search?q=pokemon+booster+box&type=product",
      "https://mytcg.co.uk/search?q=pokemon+booster+pack&type=product",
    ],
  },
  {
    name: "Gathering Games", base: "https://gatheringgames.co.uk",
    urls: [
      "https://gatheringgames.co.uk/search?q=pokemon+booster+box&type=product",
    ],
  },
  {
    name: "Magic Madhouse", base: "https://magicmadhouse.co.uk",
    urls: [
      "https://magicmadhouse.co.uk/search?q=pokemon+booster+box",
      "https://magicmadhouse.co.uk/search?q=pokemon+elite+trainer+box",
    ],
  },
  {
    name: "Chaos Cards", base: "https://www.chaoscards.co.uk",
    urls: [
      "https://www.chaoscards.co.uk/search?q=pokemon+booster+box",
      "https://www.chaoscards.co.uk/search?q=pokemon+booster+pack",
    ],
  },
];

const notified = new Set();

async function sendTelegram(msg) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID, text: msg,
        parse_mode: "HTML", disable_web_page_preview: false,
      }),
    });
    const d = await res.json();
    if (d.ok) console.log("    📱 Sent!");
    else console.log("    ❌ Telegram:", d.description);
  } catch (e) {
    console.log("    ❌ Telegram:", e.message);
  }
}

async function runScan() {
  console.log(`\n🔍 ${RETAILERS.length} retailers · ${new Date().toLocaleTimeString("en-GB")}`);
  const findings = [];

  for (const retailer of RETAILERS) {
    console.log(`  → ${retailer.name}`);
    const allItems = [];

    for (const url of retailer.urls) {
      await new Promise(r => setTimeout(r, 1200));
      const html = await fetchPage(url);
      if (!html) continue;

      const items = parseProducts(html, retailer.base);
      console.log(`    ${items.length} items from ${url.split("q=")[1]?.split("&")[0]}`);
      if (items.length > 0) console.log(`    e.g. "${items[0].title}" £${items[0].price}`);
      allItems.push(...items);
    }

    for (const item of allItems) {
      if (!isValidProduct(item.title)) continue;
      const key = `${retailer.name}::${item.url}`;
      if (!notified.has(key)) {
        notified.add(key);
        findings.push({ ...item, retailer: retailer.name });
        console.log(`    🟢 MATCH: "${item.title}" £${item.price}`);
      }
    }
  }

  console.log(`\n📊 ${findings.length} new items found`);

  for (const f of findings) {
    const rrp = getRRP(f.title);
    const resell = getResell(f.title);
    const rating = (rrp || resell) ? getDealRating(f.price, rrp || f.price, resell) : "📦 IN STOCK";

    const vsRrp = rrp ? Math.round(((f.price - rrp) / rrp) * 100) : null;
    const vsMarket = resell ? Math.round(((f.price - resell) / resell) * 100) : null;
    const ebayFees = resell ? (resell * 0.13).toFixed(2) : null;
    const flip = resell ? (resell - f.price - (resell * 0.13) - 4.00).toFixed(2) : null;
    const flipPct = resell && flip ? Math.round((parseFloat(flip) / f.price) * 100) : null;

    const lines = [
      rating, ``,
      `<b>${f.title}</b>`,
      `🏪 ${f.retailer}`,
      ``,
      `━━━━━━━━━━━━━━━━━━━`,
      `💰 BUY NOW:    £${f.price.toFixed(2)}`,
    ];

    if (rrp) {
      lines.push(`📊 RRP:        £${rrp.toFixed(2)}  (${vsRrp > 0 ? "+" : ""}${vsRrp}% vs RRP)`);
    }
    if (resell) {
      lines.push(`📈 MARKET:     £${resell.toFixed(2)}  (${vsMarket > 0 ? "+" : ""}${vsMarket}% vs market)`);
      lines.push(`━━━━━━━━━━━━━━━━━━━`);
      lines.push(`🏷️ FLIP PROFIT: ${parseFloat(flip) > 0 ? "+" : ""}£${flip} (${flipPct > 0 ? "+" : ""}${flipPct}% ROI)`);
      lines.push(`📉 eBay fees:  -£${ebayFees} + £4 postage`);
    }

    lines.push(``, `<a href="${f.url}">👉 BUY NOW →</a>`);

    await sendTelegram(lines.join("\n"));
    await new Promise(r => setTimeout(r, 500));
  }

  if (findings.length === 0) console.log("  ⬜ Nothing new this scan.");
}

console.log("🚀 Lock3y's PokéScraper — Full Coverage");
console.log("🇬🇧 English sealed products only");
console.log("📊 Rated vs MARKET price (eBay sold) not just RRP\n");

runScan()
  .then(() => { console.log("\n✅ Done."); process.exit(0); })
  .catch(e => { console.error("Fatal:", e.message); process.exit(1); });
