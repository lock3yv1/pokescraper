import * as cheerio from 'cheerio';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const RRP = {
  "booster box": 144.99, "elite trainer box": 49.99, "etb": 49.99,
  "booster bundle": 24.99, "upc": 119.99, "tin": 24.99, "booster pack": 4.49
};

const RESELL = {
  "151 booster box": 180, "151 booster bundle": 55, "151 etb": 70,
  "prismatic evolutions booster box": 220, "prismatic evolutions etb": 95,
  "surging sparks booster box": 155, "evolving skies booster box": 800,
  "perfect order etb": 60, "journey together booster box": 120,
  "ascended heroes etb": 65, "destined rivals booster box": 130
};

// These are the specific terms we will force-search to find "Everything"
const TARGET_SETS = ["151", "evolutions", "evolving skies", "surging sparks", "perfect order", "ascended heroes", "destined rivals"];
const PRODUCT_KEYWORDS = ["booster box","elite trainer box","etb","booster bundle","upc"];
const EXCLUDE = ["japanese","jp","korean","chinese","sleeve","binder","playmat","digital"];

function isValid(title) {
  const t = title.toLowerCase();
  if (EXCLUDE.some(k => t.includes(k))) return false;
  return PRODUCT_KEYWORDS.some(k => t.includes(k));
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
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" } 
    });
    return res.ok ? await res.text() : null;
  } catch { return null; }
}

function extractProducts(html, baseUrl) {
  const $ = cheerio.load(html);
  const items = [];
  $(".product-item, .product-card, .grid__item, .card-wrapper, .product-block, .product, .col-sm-4, .item, .product-layout").each((_, el) => {
    const title = $(el).find("h2, h3, h4, .product-title, .title, .name, .product-name").first().text().replace(/\s+/g, ' ').trim();
    const priceText = $(el).find("[class*='price'], .amount, .current-price, .price").first().text().replace(/[^0-9.]/g, "");
    const price = parseFloat(priceText);
    const link = $(el).find("a[href]").first().attr("href");
    if (title && price > 5 && link && !$(el).text().toLowerCase().includes("sold out")) {
      const fullUrl = link.startsWith("http") ? link : `${new URL(baseUrl).origin}${link.startsWith('/') ? '' : '/'}${link}`;
      items.push({ title, price, url: fullUrl });
    }
  });
  return items;
}

const RETAILERS = [
  "https://minisouk.com", "https://www.totalcards.net", "https://japan2uk.com",
  "https://www.titancards.co.uk", "https://www.doublesleeved.co.uk", "https://thecardvault.co.uk",
  "https://magicmadhouse.co.uk", "https://www.chaoscards.co.uk", "https://mytcg.co.uk"
];

async function runScan() {
  const notified = new Set();
  console.log("🚀 STARTING DEEP SET CRAWL...");

  for (const set of TARGET_SETS) {
    console.log(`\n🔍 Searching for: ${set.toUpperCase()}`);
    for (const base of RETAILERS) {
      const searchUrl = `${base}/search?q=pokemon+${set.replace(' ', '+')}`;
      const html = await fetchPage(searchUrl);
      if (!html) continue;

      const items = extractProducts(html, base);
      for (const item of items) {
        if (isValid(item.title) && !notified.has(item.url)) {
          const rrp = getMatch(item.title, RRP);
          const resell = getMatch(item.title, RESELL);

          if (rrp && resell) {
            notified.add(item.url);
            const diff = Math.round(((item.price - rrp) / rrp) * 100);
            const flip = (resell - item.price - (resell * 0.13) - 4).toFixed(2);
            const score = diff <= 5 ? "🔥 DEAL" : "❌ OVERPRICED";

            const msg = `${score}\n\n<b>${item.title}</b>\n💰 BUY: £${item.price.toFixed(2)}\n📊 RRP: £${rrp.toFixed(2)} (${diff > 0 ? "+" : ""}${diff}%)\n📈 RESELL: £${resell.toFixed(2)}\n🏷️ FLIP: £${flip}\n\n👉 <a href="${item.url}">BUY NOW →</a>`;

            await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { 
              method: "POST", 
              headers: { "Content-Type": "application/json" }, 
              body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML" }) 
            });
          }
        }
      }
      await wait(1000); // Small jitter to keep connection alive
    }
  }
}

runScan().then(() => { console.log("✅ Deep Scan Complete."); process.exit(0); });
