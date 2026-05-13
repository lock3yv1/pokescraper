const cheerio = require("cheerio");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const RRP = {
  "booster box": 144.99, "elite trainer box": 49.99, "etb": 49.99,
  "half box": 74.99, "booster bundle": 24.99, "booster pack": 4.49,
  "mini tins": 44.99, "collection box": 34.99, "poster collection": 19.99,
  "build and battle": 24.99, "pin collection": 34.99,
  "premier deck": 49.99, "ultra premium collection": 119.99,
  "league battle deck": 39.99, "tin": 24.99, "blister": 4.99,
  "premium collection": 39.99, "special collection": 29.99
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
  "journey together booster bundle": 28, "journey together booster pack": 7.50,
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
  "ninja spinner booster box": 150, "heat wave arena booster box": 180,
  "mega dream ex booster box": 160
};

const PRODUCT_KEYWORDS = [
  "booster box","elite trainer box","etb","half box","booster bundle",
  "booster pack","collection box","poster collection","build and battle",
  "pin collection","premier deck","mini tins","ultra premium collection",
  "league battle deck","tin","blister","premium collection","special collection"
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
  "ninja spinner", "heat wave arena", "mega dream ex", "mega evolution"
];

function isValid(title) {
  const t = title.toLowerCase();
  if (t.includes("<img") || t.includes("<script")) return false;
  if (!t.includes("pokemon") && !t.includes("pokémon")) return false;
  if (EXCLUDE.some(k => t.includes(k))) return false;
  
  const hasKeyword = PRODUCT_KEYWORDS.some(k => t.includes(k));
  const hasSet = SETS.some(s => t.includes(s));
  return hasKeyword && hasSet;
}

function getRRP(title) {
  const t = title.toLowerCase();
  let bestMatch = null;
  for (const [k, v] of Object.entries(RRP)) {
    if (t.includes(k)) {
      if (!bestMatch || k.length > bestMatch.key.length) bestMatch = { key: k, val: v };
    }
  }
  return bestMatch ? bestMatch.val : null;
}

function getResell(title) {
  const t = title.toLowerCase();
  let bestMatch = null;
  for (const [k, v] of Object.entries(RESELL)) {
    if (t.includes(k)) {
      if (!bestMatch || k.length > bestMatch.key.length) bestMatch = { key: k, val: v };
    }
  }
  return bestMatch ? bestMatch.val : null;
}

function dealScore(buy, rrp) {
  const d = ((buy-rrp)/rrp)*100;
  if (d<=-15) return "🔥 EXCELLENT DEAL";
  if (d<=-5)  return "✅ GOOD DEAL";
  if (d<=5)   return "⚖️ FAIR PRICE";
  if (d<=20)  return "⚠️ SLIGHTLY OVERPRICED";
  return "❌ OVERPRICED";
}

async function fetchPage(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      }
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    clearTimeout(timer);
    return null;
  }
}

function extractProducts(html, baseUrl) {
  const $ = cheerio.load(html);
  const items = [];
  const selectors = [".product-item", ".product-card", ".grid__item", ".card-wrapper", "[data-product-id]", ".product", ".product-block"];

  for (const sel of selectors) {
    $(sel).each((_, el) => {
      let title = $(el).find("h2, h3, h4, .card__heading, .product-item__title, .product-title").first().text().replace(/\s+/g, ' ').trim();
      if (!title || title.includes("<img")) return;

      const priceEl = $(el).find(".price__regular, .price-item--regular, .price:not(.price--sold-out), [class*='price']").first();
      let priceText = priceEl.text().trim().replace(/[^0-9.]/g, "");
      const price = parseFloat(priceText) || 0;

      const link = $(el).find("a[href]").first().attr("href");
      const soldOut = $(el).text().toLowerCase().includes("sold out") || $(el).find("[class*='sold-out']").length > 0;

      if (title && !soldOut && price > 0 && price < 2000 && link) {
        items.push({ 
          title, 
          price, 
          url: link.startsWith("http") ? link : `${baseUrl.replace(/\/$/, '')}/${link.replace(/^\//, '')}` 
        });
      }
    });
    if (items.length > 5) break; 
  }
  return items;
}

const RETAILERS = [
  { name: "Total Cards",     base: "https://totalcards.net",          url: "https://totalcards.net/search?q=pokemon+sealed&type=product" },
  { name: "Titan Cards",     base: "https://titancards.co.uk",        url: "https://titancards.co.uk/search?q=pokemon+sealed&type=product" },
  { name: "Eterna Cards",    base: "https://eternacards.co.uk",       url: "https://eternacards.co.uk/search?q=pokemon+sealed&type=product" },
  { name: "Double Sleeved",  base: "https://doublesleeved.co.uk",     url: "https://doublesleeved.co.uk/search?q=pokemon+sealed&type=product" },
  { name: "The Card Vault",  base: "https://thecardvault.co.uk",      url: "https://thecardvault.co.uk/search?q=pokemon+sealed&type=product" },
  { name: "My TCG",          base: "https://mytcg.co.uk",             url: "https://mytcg.co.uk/search?q=pokemon+sealed&type=product" },
  { name: "Japan2UK",        base: "https://japan2uk.com",            url: "https://japan2uk.com/search?q=pokemon+english+sealed&type=product" },
  { name: "Cosmic Col.",     base: "https://cosmiccollectables.co.uk", url: "https://cosmiccollectables.co.uk/search?q=pokemon+sealed&type=product" },
  { name: "Geeky Zone",      base: "https://geekyzone.co.uk",         url: "https://geekyzone.co.uk/search?q=pokemon+sealed&type=product" }
];

const notified = new Set();

async function sendTelegram(msg) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML", disable_web_page_preview: false }),
    });
  } catch (e) { console.log("Telegram Error"); }
}

async function runScan() {
  console.log(`\n🔍 ${RETAILERS.length} retailers · ${new Date().toLocaleTimeString("en-GB")}`);
  const findings = [];

  for (const retailer of RETAILERS) {
    process.stdout.write(`  → ${retailer.name} ... `);
    const html = await fetchPage(retailer.url);
    if (!html) { console.log("failed"); continue; }

    const items = extractProducts(html, retailer.base);
    console.log(`${items.length} items found`);

    for (const item of items) {
      if (!isValid(item.title)) continue;
      const rrp = getRRP(item.title);
      const resell = getResell(item.title);
      if (!rrp || !resell) continue;
      
      const key = `${retailer.name}::${item.url}`;
      if (!notified.has(key)) {
        notified.add(key);
        findings.push({ ...item, retailer: retailer.name, rrp, resell });
      }
    }
    await new Promise(r => setTimeout(r, 1000));
  }

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
    await new Promise(r => setTimeout(r, 500));
  }
}

console.log("🚀 Lock3y's PokéScraper — Active Mode");
runScan().then(() => { console.log("\n✅ Done."); process.exit(0); });
