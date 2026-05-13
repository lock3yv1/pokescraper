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

// Use native fetch with AbortController — guaranteed timeout
async function fetchPage(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
      }
    });
    clearTimeout(timer);
    return await res.text();
  } catch (e) {
    clearTimeout(timer);
    console.log(`  ⏭ ${url.split("/")[2]}: ${e.message.slice(0,40)}`);
    return null;
  }
}

function parseShopify(html, baseUrl) {
  const $ = cheerio.load(html);
  const items = [];
  $(".product-card, .grid__item, .card-wrapper, .product-item").each((_, el) => {
    const title = $(el).find("h2,h3,h4,.card__heading,.product-item__title,.product-title").first().text().trim();
    const priceText = $(el).find(".price,.price__regular,.product-price").first().text().trim();
    const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
    const link = $(el).find("a[href]").first().attr("href");
    const soldOut = $(el).text().toLowerCase().includes("sold out");
    if (title && !soldOut && price > 0 && link) {
      items.push({ title, price, url: link.startsWith("http") ? link : `${baseUrl}${link}` });
    }
  });
  return items;
}

// Only most reliable Shopify-based UK retailers
const RETAILERS = [
  { name: "Total Cards",    base: "https://totalcards.net",           pages: ["/collections/pokemon-booster-boxes", "/collections/pokemon-elite-trainer-boxes"] },
  { name: "Titan Cards",    base: "https://titancards.co.uk",         pages: ["/collections/pokemon-sealed-products"] },
  { name: "Eterna Cards",   base: "https://eternacards.co.uk",        pages: ["/collections/pokemon-tcg-sealed-products"] },
  { name: "PACKRAT",        base: "https://packratt.co.uk",           pages: ["/collections/pokemon"] },
  { name: "Big Orbit",      base: "https://www.bigorbitcards.co.uk",  pages: ["/collections/pokemon-sealed"] },
  { name: "Double Sleeved", base: "https://doublesleeved.co.uk",      pages: ["/collections/pokemon"] },
  { name: "Toys N Geek",    base: "https://www.toysngeek.co.uk",      pages: ["/collections/pokemon"] },
  { name: "The Card Vault", base: "https://thecardvault.co.uk",       pages: ["/collections/pokemon-tcg-sealed-products"] },
  { name: "My TCG",         base: "https://mytcg.co.uk",              pages: ["/collections/pokemon"] },
  { name: "Gathering Games",base: "https://gatheringgames.co.uk",     pages: ["/collections/pokemon"] },
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
    if (data.ok) console.log("  📱 Sent!");
    else console.log("  ❌ Telegram error:", data.description);
  } catch (e) {
    console.log("  ❌ Telegram:", e.message);
  }
}

async function runScan() {
  console.log(`\n🔍 ${RETAILERS.length} retailers · ${new Date().toLocaleTimeString("en-GB")}`);
  const findings = [];

  for (const retailer of RETAILERS) {
    process.stdout.write(`  → ${retailer.name} ... `);
    let count = 0;

    for (const path of retailer.pages) {
      const html = await fetchPage(`${retailer.base}${path}`);
      if (!html) continue;

      const items = parseShopify(html, retailer.base);
      for (const item of items) {
        if (!isValid(item.title)) continue;
        const rrp = getRRP(item.title);
        const resell = getResell(item.title);
        if (!rrp || !resell) continue;
        const key = `${retailer.name}::${item.url}`;
        if (!notified.has(key)) {
          notified.add(key);
          findings.push({ ...item, retailer: retailer.name, rrp, resell });
          count++;
        }
      }
    }
    console.log(`${count} found`);
  }

  console.log(`\n📊 Total: ${findings.length} new confirmed deals`);

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

console.log("🚀 Lock3y's PokéScraper");
console.log("⚡ Native fetch + AbortController — guaranteed timeouts\n");

runScan()
  .then(() => { console.log("\n✅ Done."); process.exit(0); })
  .catch(e => { console.error("Fatal:", e.message); process.exit(1); });
