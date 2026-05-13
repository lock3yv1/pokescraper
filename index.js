const cheerio = require("cheerio");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const RRP = {
  "booster box": 144.99, "elite trainer box": 49.99, "etb": 49.99,
  "half box": 74.99, "booster bundle": 24.99, "booster pack": 4.49,
  "mini tins": 44.99, "collection box": 34.99, "poster collection": 19.99,
  "build and battle": 24.99, "pin collection": 34.99,
  "premier deck": 49.99, "ultra premium collection": 119.99,
  "league battle deck": 39.99, "tin": 24.99,
};

const RESELL = {
  "ascended heroes elite trainer box": 65, "ascended heroes booster bundle": 38,
  "ascended heroes booster pack": 6.50,
  "destined rivals booster box": 130, "destined rivals elite trainer box": 58,
  "destined rivals booster bundle": 32, "destined rivals booster pack": 5.50,
  "perfect order booster box": 160, "perfect order elite trainer box": 60,
  "chaos rising booster box": 190, "chaos rising elite trainer box": 70,
  "chaos rising booster pack": 8.00,
  "phantasmal flames booster box": 280, "phantasmal flames elite trainer box": 90,
  "phantasmal flames booster pack": 12.00,
  "journey together booster box": 120, "journey together elite trainer box": 52,
  "journey together booster bundle": 28, "journey together booster pack": 5.00,
  "prismatic evolutions booster box": 220, "prismatic evolutions booster bundle": 90,
  "prismatic evolutions elite trainer box": 95, "prismatic evolutions booster pack": 18.00,
  "surging sparks booster box": 155, "surging sparks elite trainer box": 60,
  "surging sparks booster pack": 6.50,
  "stellar crown booster box": 190, "stellar crown elite trainer box": 65,
  "temporal forces booster box": 115, "temporal forces elite trainer box": 52,
  "paradox rift booster box": 120, "paradox rift elite trainer box": 55,
  "obsidian flames booster box": 130, "obsidian flames elite trainer box": 58,
  "151 booster box": 180, "151 booster bundle": 55,
  "151 elite trainer box": 70, "151 booster pack": 8.00,
  "evolving skies booster box": 800, "evolving skies elite trainer box": 180,
  "evolving skies booster pack": 28.00,
  "brilliant stars booster box": 150, "fusion strike booster box": 145,
  "lost origin booster box": 130, "silver tempest booster box": 125,
  "crown zenith booster box": 140, "chilling reign booster box": 160,
  "battle styles booster box": 180, "shining fates booster box": 250,
  "hidden fates booster box": 400, "hidden fates booster pack": 15.00,
};

const PRODUCT_KEYWORDS = [
  "booster box","elite trainer box","etb","half box","booster bundle",
  "booster pack","collection box","poster collection","build and battle",
  "pin collection","premier deck","mini tins","ultra premium collection",
  "league battle deck","tin",
];

const EXCLUDE = [
  "yugioh","yu-gi-oh","magic the gathering","mtg","digimon","one piece",
  "dragon ball","lorcana","cardfight","vanguard","weiss","buddyfight",
  "single","graded","psa","bgs","cgc","lot of","proxy","fake",
  "sleeve","playmat","binder","dice","coin","bulk","funko","plush",
];

const SETS = [
  "ascended heroes","destined rivals","perfect order","chaos rising",
  "phantasmal flames","journey together","prismatic evolutions",
  "surging sparks","stellar crown","temporal forces","paradox rift",
  "obsidian flames","151","evolving skies","brilliant stars",
  "fusion strike","lost origin","silver tempest","crown zenith",
  "chilling reign","battle styles","shining fates","hidden fates",
];

function isValid(title) {
  const t = title.toLowerCase();
  if (!t.includes("pokemon")) return false;
  if (EXCLUDE.some(k => t.includes(k))) return false;
  if (!PRODUCT_KEYWORDS.some(k => t.includes(k))) return false;
  if (!SETS.some(s => t.includes(s))) return false;
  return true;
}

function getRRP(title) {
  const t = title.toLowerCase();
  const sorted = Object.entries(RRP).sort((a,b) => b[0].length - a[0].length);
  for (const [k,v] of sorted) if (t.includes(k)) return v;
  return null;
}

function getResell(title) {
  const t = title.toLowerCase();
  const sorted = Object.entries(RESELL).sort((a,b) => b[0].length - a[0].length);
  for (const [k,v] of sorted) if (t.includes(k)) return v;
  return null;
}

function dealScore(buy, rrp) {
  const d = ((buy-rrp)/rrp)*100;
  if (d<=-15) return "🔥 EXCELLENT DEAL";
  if (d<=-5)  return "✅ GOOD DEAL";
  if (d<=5)   return "⚖️ FAIR PRICE";
  if (d<=20)  return "⚠️ SLIGHTLY OVERPRICED";
  return "❌ OVERPRICED";
}

async function fetchPage(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
      }
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.log(`    HTTP ${res.status} for ${url}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    clearTimeout(timer);
    console.log(`    Timeout/error: ${e.message.slice(0,50)}`);
    return null;
  }
}

// Try multiple CSS selector strategies
function extractProducts(html, baseUrl) {
  const $ = cheerio.load(html);
  const items = [];

  // Strategy 1: JSON-LD structured data (most reliable)
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html());
      const products = data["@type"] === "ItemList" ? data.itemListElement :
                       data["@type"] === "Product" ? [data] : [];
      for (const p of products) {
        const item = p.item || p;
        const title = item.name;
        const price = parseFloat(item.offers?.price || item.offers?.lowPrice || 0);
        const url = item.url || item["@id"];
        const inStock = !item.offers?.availability?.includes("OutOfStock");
        if (title && price > 0 && url && inStock) {
          items.push({ title, price, url: url.startsWith("http") ? url : `${baseUrl}${url}` });
        }
      }
    } catch {}
  });

  if (items.length > 0) return items;

  // Strategy 2: Common product grid selectors
  const selectors = [
    ".product-item",
    ".product-card",
    ".grid__item",
    ".card-wrapper",
    "[data-product-id]",
    ".boost-pfs-filter-products article",
    ".collection-product-card",
    "li.grid__item",
    ".product",
  ];

  for (const sel of selectors) {
    $(sel).each((_, el) => {
      const titleEl = $(el).find("h2, h3, h4, .card__heading, .product-item__title, .product-title, .product-name, a[aria-label]").first();
      const title = titleEl.text().trim() || titleEl.attr("aria-label") || "";
      const priceText = $(el).find(".price, .price__regular, .price__sale, [class*='price']").first().text().trim();
      const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
      const link = $(el).find("a[href]").first().attr("href");
      const soldOut = $(el).text().toLowerCase().includes("sold out") || 
                      $(el).find("[class*='sold'], [class*='unavailable']").length > 0;

      if (title && !soldOut && price > 0 && link) {
        items.push({ title, price, url: link.startsWith("http") ? link : `${baseUrl}${link}` });
      }
    });
    if (items.length > 0) break;
  }

  // Strategy 3: Look for product links with prices anywhere on page
  if (items.length === 0) {
    $("a[href*='/products/']").each((_, el) => {
      const title = $(el).text().trim() || $(el).attr("aria-label") || "";
      const parent = $(el).closest("li, article, div.product, div.item");
      const priceText = parent.find("[class*='price']").first().text().trim();
      const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
      if (title && price > 0) {
        const href = $(el).attr("href");
        items.push({ title, price, url: href.startsWith("http") ? href : `${baseUrl}${href}` });
      }
    });
  }

  return items;
}

// Use search URLs which are more reliable than category pages
const RETAILERS = [
  { name: "Total Cards",     base: "https://totalcards.net",          url: "https://totalcards.net/search?q=pokemon+booster+box+etb&type=product" },
  { name: "Titan Cards",     base: "https://titancards.co.uk",        url: "https://titancards.co.uk/search?q=pokemon+booster+box&type=product" },
  { name: "Eterna Cards",    base: "https://eternacards.co.uk",       url: "https://eternacards.co.uk/search?q=pokemon+booster+box&type=product" },
  { name: "PACKRAT",         base: "https://packratt.co.uk",          url: "https://packratt.co.uk/search?q=pokemon+booster+box&type=product" },
  { name: "Big Orbit",       base: "https://www.bigorbitcards.co.uk", url: "https://www.bigorbitcards.co.uk/search?q=pokemon+booster+box&type=product" },
  { name: "Double Sleeved",  base: "https://doublesleeved.co.uk",     url: "https://doublesleeved.co.uk/search?q=pokemon+booster+box&type=product" },
  { name: "Toys N Geek",     base: "https://www.toysngeek.co.uk",     url: "https://www.toysngeek.co.uk/search?q=pokemon+booster+box&type=product" },
  { name: "The Card Vault",  base: "https://thecardvault.co.uk",      url: "https://thecardvault.co.uk/search?q=pokemon+booster+box&type=product" },
  { name: "My TCG",          base: "https://mytcg.co.uk",             url: "https://mytcg.co.uk/search?q=pokemon+booster+box&type=product" },
  { name: "Chaos Cards",     base: "https://www.chaoscards.co.uk",    url: "https://www.chaoscards.co.uk/search?q=pokemon+booster+box" },
  { name: "Magic Madhouse",  base: "https://magicmadhouse.co.uk",     url: "https://magicmadhouse.co.uk/search?q=pokemon+booster+box" },
];

const notified = new Set();

async function sendTelegram(msg) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML", disable_web_page_preview: false }),
    });
    const data = await res.json();
    if (data.ok) console.log("    📱 Sent!");
    else console.log("    ❌ Telegram:", data.description);
  } catch (e) {
    console.log("    ❌ Telegram:", e.message);
  }
}

async function runScan() {
  console.log(`\n🔍 ${RETAILERS.length} retailers · ${new Date().toLocaleTimeString("en-GB")}`);
  const findings = [];

  for (const retailer of RETAILERS) {
    process.stdout.write(`  → ${retailer.name} ... `);
    
    const html = await fetchPage(retailer.url);
    if (!html) { console.log("failed"); continue; }

    const items = extractProducts(html, retailer.base);
    console.log(`${items.length} items scraped`);

    // Debug: show first few items found
    items.slice(0,3).forEach(item => console.log(`    📄 "${item.title}" £${item.price}`));

    for (const item of items) {
      if (!isValid(item.title)) continue;
      const rrp = getRRP(item.title);
      const resell = getResell(item.title);
      if (!rrp || !resell) continue;
      const key = `${retailer.name}::${item.url}`;
      if (!notified.has(key)) {
        notified.add(key);
        findings.push({ ...item, retailer: retailer.name, rrp, resell });
        console.log(`    🟢 MATCH: ${item.title} — £${item.price}`);
      }
    }
  }

  console.log(`\n📊 Total confirmed deals: ${findings.length}`);

  for (const f of findings) {
    const score = dealScore(f.price, f.rrp);
    const vsRrp = Math.round(((f.price-f.rrp)/f.rrp)*100);
    const vsResell = Math.round(((f.resell-f.price)/f.price)*100);
    const flip = (f.resell - f.price - (f.resell*0.13) - 4).toFixed(2);

    const msg = [
      score, ``,
      `<b>${f.title}</b>`,
      `🏪 ${f.retailer}`, ``,
      `💰 BUY NOW:  £${f.price.toFixed(2)}`,
      `📊 RRP:      £${f.rrp.toFixed(2)}  (${vsRrp>0?"+":""}${vsRrp}% vs RRP)`,
      `📈 RESELL:   £${f.resell.toFixed(2)}  (${vsResell>0?"+":""}${vsResell}% potential)`,
      `🏷️ FLIP:     ${flip>0?"+":""}£${flip} after eBay fees`, ``,
      `<a href="${f.url}">👉 BUY NOW →</a>`,
    ].join("\n");

    await sendTelegram(msg);
    await new Promise(r => setTimeout(r, 300));
  }

  if (findings.length === 0) console.log("  ⬜ Nothing new this scan.");
}

console.log("🚀 Lock3y's PokéScraper — Debug Mode");
runScan()
  .then(() => { console.log("\n✅ Done."); process.exit(0); })
  .catch(e => { console.error("Fatal:", e.message); process.exit(1); });
