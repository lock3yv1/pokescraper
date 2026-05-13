import * as cheerio from 'cheerio';

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
  "ascended heroes elite trainer box": 65, "ascended heroes booster bundle": 38, "ascended heroes booster pack": 6.50,
  "destined rivals booster box": 130, "destined rivals elite trainer box": 58, "destined rivals booster bundle": 32, "destined rivals booster pack": 5.50,
  "perfect order booster box": 160, "perfect order elite trainer box": 60,
  "chaos rising booster box": 190, "chaos rising elite trainer box": 70, "chaos rising booster pack": 8.00,
  "phantasmal flames booster box": 280, "phantasmal flames elite trainer box": 90, "phantasmal flames booster pack": 12.00,
  "journey together booster box": 120, "journey together elite trainer box": 52, "journey together booster bundle": 28, "journey together booster pack": 7.50,
  "prismatic evolutions booster box": 220, "prismatic evolutions booster bundle": 90, "prismatic evolutions elite trainer box": 95, "prismatic evolutions booster pack": 18.00,
  "surging sparks booster box": 155, "surging sparks elite trainer box": 60, "surging sparks booster pack": 6.50,
  "stellar crown booster box": 190, "stellar crown elite trainer box": 65,
  "temporal forces booster box": 115, "temporal forces elite trainer box": 52,
  "paradox rift booster box": 120, "paradox rift elite trainer box": 55,
  "obsidian flames booster box": 130, "obsidian flames elite trainer box": 58,
  "151 booster box": 180, "151 booster bundle": 55, "151 elite trainer box": 70, "151 booster pack": 8.00,
  "evolving skies booster box": 800, "evolving skies elite trainer box": 180, "evolving skies booster pack": 28.00,
  "brilliant stars booster box": 150, "fusion strike booster box": 145, "lost origin booster box": 130, "silver tempest booster box": 125,
  "crown zenith booster box": 140, "chilling reign booster box": 160, "battle styles booster box": 180, "shining fates booster box": 250,
  "hidden fates booster box": 400, "hidden fates booster pack": 15.00,
  "ninja spinner booster box": 150, "heat wave arena booster box": 180, "mega dream ex booster box": 160
};

const SETS = ["ascended heroes","destined rivals","perfect order","chaos rising","phantasmal flames","journey together","prismatic evolutions","surging sparks","stellar crown","temporal forces","paradox rift","obsidian flames","151","evolving skies","brilliant stars","fusion strike","lost origin","silver tempest","crown zenith","chilling reign","battle styles","shining fates","hidden fates","ninja spinner","heat wave arena","mega dream ex","mega evolution"];
const PRODUCT_KEYWORDS = ["booster box","elite trainer box","etb","booster bundle","booster pack","collection box","tin","blister","premium collection","special collection","upc"];
const EXCLUDE = ["yugioh","yu-gi-oh","mtg","magic","lorcana","single","graded","psa","sleeve","playmat","binder","japanese","jp"];

function isValid(title) {
  const t = title.toLowerCase();
  if (EXCLUDE.some(k => t.includes(k))) return false;
  return SETS.some(s => t.includes(s)) && PRODUCT_KEYWORDS.some(k => t.includes(k));
}

function getMatch(title, list) {
  const t = title.toLowerCase();
  let best = null;
  for (const [k, v] of Object.entries(list)) {
    if (t.includes(k) && (!best || k.length > best.k.length)) best = { k, v };
  }
  return best ? best.v : null;
}

async function fetchPage(url) {
  try {
    const res = await fetch(url, { 
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" } 
    });
    return res.ok ? await res.text() : null;
  } catch { return null; }
}

function extractProducts(html, baseUrl) {
  const $ = cheerio.load(html);
  const items = [];
  $(".product-item, .product-card, .grid__item, .card-wrapper, .product-block, .product, .col-sm-4").each((_, el) => {
    const title = $(el).find("h2, h3, h4, .product-title, .title, .name").first().text().replace(/\s+/g, ' ').trim();
    const priceText = $(el).find("[class*='price'], .amount, .current-price").first().text().replace(/[^0-9.]/g, "");
    const price = parseFloat(priceText);
    const link = $(el).find("a[href]").first().attr("href");
    if (title && price > 0 && link && !$(el).text().toLowerCase().includes("sold out")) {
      const fullUrl = link.startsWith("http") ? link : `${new URL(baseUrl).origin}${link.startsWith('/') ? '' : '/'}${link}`;
      items.push({ title, price, url: fullUrl });
    }
  });
  return items;
}

const RETAILERS = [
  { name: "Miniso", base: "https://minisouk.com", url: "https://minisouk.com/search?q=pokemon&sort_by=created-descending" },
  { name: "Total Cards", base: "https://totalcards.net", url: "https://totalcards.net/search?q=pokemon+sealed&sort=created-descending" },
  { name: "Japan2UK", base: "https://japan2uk.com", url: "https://japan2uk.com/search?q=pokemon+english&sort_by=created-descending" },
  { name: "Titan Cards", base: "https://titancards.co.uk", url: "https://titancards.co.uk/search?q=pokemon+sealed&sort_by=created-descending" },
  { name: "Double Sleeved", base: "https://doublesleeved.co.uk", url: "https://doublesleeved.co.uk/search?q=pokemon&sort_by=created-descending" },
  { name: "The Card Vault", base: "https://thecardvault.co.uk", url: "https://thecardvault.co.uk/search?q=pokemon+sealed&sort_by=created-descending" },
  { name: "Cosmic Col.", base: "https://cosmiccollectables.co.uk", url: "https://cosmiccollectables.co.uk/search?q=pokemon&sort_by=created-descending" },
  { name: "My TCG", base: "https://mytcg.co.uk", url: "https://mytcg.co.uk/search?q=pokemon+sealed&sort_by=created-descending" }
];

const notified = new Set();

async function runScan() {
  console.log(`🔍 BROAD SEARCH Started: ${new Date().toLocaleTimeString()}`);
  for (const shop of RETAILERS) {
    const html = await fetchPage(shop.url);
    if (!html) { console.log(`  → ${shop.name} (Check failed)`); continue; }
    const items = extractProducts(html, shop.base);
    console.log(`  → ${shop.name} (${items.length} items scanned)`);
    for (const item of items) {
      if (isValid(item.title)) {
        const rrp = getMatch(item.title, RRP);
        const resell = getMatch(item.title, RESELL);
        if (rrp && resell && !notified.has(item.url)) {
          notified.add(item.url);
          const diff = Math.round(((item.price - rrp) / rrp) * 100);
          const flip = (resell - item.price - (resell * 0.13) - 4).toFixed(2);
          const score = diff <= 5 ? "🔥 DEAL" : "❌ OVERPRICED";
          
          const msg = `${score}\n\n<b>${item.title}</b>\n🏪 ${shop.name}\n💰 BUY: £${item.price.toFixed(2)}\n📊 RRP: £${rrp.toFixed(2)} (${diff > 0 ? "+" : ""}${diff}%)\n📈 RESELL: £${resell.toFixed(2)}\n🏷️ FLIP: £${flip}\n\n👉 <a href="${item.url}">BUY NOW →</a>`;
          
          await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { 
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML" }) 
          });
        }
      }
    }
  }
}

runScan().then(() => { console.log("✅ Done."); process.exit(0); });
