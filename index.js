import * as cheerio from 'cheerio';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const RRP = {
  "booster box": 144.99, "elite trainer box": 49.99, "etb": 49.99,
  "booster bundle": 24.99, "upc": 119.99, "ultra premium": 119.99,
  "booster pack": 4.49, "collection box": 29.99, "tin": 24.99
};

const RESELL = {
  "151 booster box": 180, "151 booster bundle": 55, "151 etb": 70,
  "prismatic evolutions booster box": 220, "prismatic evolutions etb": 95,
  "surging sparks booster box": 155, "evolving skies booster box": 800,
  "perfect order etb": 60, "journey together booster box": 120,
  "ascended heroes etb": 65, "destined rivals booster box": 130
};

const PRODUCT_KEYWORDS = ["booster box", "box", "etb", "trainer box", "bundle", "upc", "premium collection", "tin"];
const EXCLUDE = ["single", "promo", "graded", "psa", "sleeve", "binder", "playmat", "digital", "japanese", "jp", "korean"];

function getAnalysis(title, price) {
  const t = title.toLowerCase();
  
  // Strict block on singles and promos
  if (EXCLUDE.some(k => t.includes(k))) return null;
  if (!PRODUCT_KEYWORDS.some(k => t.includes(k))) return null;

  // Accurately assign RRP based on product type
  let rrpVal = null;
  for (const [key, val] of Object.entries(RRP)) {
    if (t.includes(key)) { rrpVal = val; break; }
  }
  if (!rrpVal) return null;

  // Accurately assign Resell or default to +15%
  let resellVal = null;
  for (const [key, val] of Object.entries(RESELL)) {
    if (t.includes(key)) { resellVal = val; break; }
  }
  if (!resellVal) resellVal = rrpVal * 1.15;

  const diff = Math.round(((price - rrpVal) / rrpVal) * 100);
  const flip = (resellVal - price - (resellVal * 0.13) - 4).toFixed(2);

  return { rrp: rrpVal, resell: resellVal, diff, flip };
}

async function fetchPage(url) {
  try {
    // Reverted to the simple header that successfully connected in your very first log
    const res = await fetch(url, { 
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" } 
    });
    return res.ok ? await res.text() : null;
  } catch { return null; }
}

function extract(html, base) {
  const $ = cheerio.load(html);
  const items = [];
  $(".product-item, .product-card, .grid__item, .card-wrapper, .product-block, .product, .item, .product-layout, .product-grid-item").each((_, el) => {
    const title = $(el).find("h2, h3, h4, .product-title, .title, .name").first().text().trim();
    const priceText = $(el).find("[class*='price'], .amount, .money").first().text().replace(/[^0-9.]/g, "");
    const price = parseFloat(priceText);
    const link = $(el).find("a[href]").first().attr("href");
    
    // Price floor > 12 to double-check no cheap singles slip through
    if (title && price > 12 && link && !$(el).text().toLowerCase().includes("sold out")) {
      const url = link.startsWith("http") ? link : `${new URL(base).origin}${link.startsWith('/') ? '' : '/'}${link}`;
      items.push({ title, price, url });
    }
  });
  return items;
}

const RETAILERS = [
  "https://minisouk.com", "https://japan2uk.com", "https://thecardvault.co.uk",
  "https://doublesleeved.co.uk", "https://www.totalcards.net", "https://mytcg.co.uk"
];

// Instead of hitting the blocked collection pages, we search for broad terms
const QUERIES = ["pokemon+booster+box", "pokemon+elite+trainer", "pokemon+bundle"];

async function run() {
  console.log(`🚀 ANTI-BLOCK SCAN STARTED...`);
  const notified = new Set();

  for (const base of RETAILERS) {
    console.log(`Checking ${base}...`);
    let foundItems = 0;

    for (const q of QUERIES) {
      const url = `${base}/search?q=${q}`;
      const html = await fetchPage(url);
      if (!html) continue;

      const items = extract(html, base);
      foundItems += items.length;

      for (const item of items) {
        const analysis = getAnalysis(item.title, item.price);
        if (analysis && !notified.has(item.url)) {
          notified.add(item.url);
          const score = analysis.diff <= 5 ? "🔥 DEAL" : "❌ OVERPRICED";
          const shopName = base.replace('https://', '').replace('www.', '');
          
          const msg = `${score}\n\n<b>${item.title}</b>\n🏪 ${shopName}\n💰 BUY: £${item.price.toFixed(2)}\n📊 RRP: £${analysis.rrp.toFixed(2)} (${analysis.diff > 0 ? "+" : ""}${analysis.diff}%)\n📈 RESELL: £${analysis.resell.toFixed(2)}\n🏷️ FLIP: £${analysis.flip}\n\n👉 <a href="${item.url}">BUY NOW →</a>`;

          await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { 
            method: "POST", headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML" }) 
          });
        }
      }
      await wait(1500); // 1.5s wait between queries
    }
    
    if (foundItems === 0) {
      console.log(`  ⚠️ Blocked or 0 items found.`);
    } else {
      console.log(`  ✅ Scanned ${foundItems} total items from search.`);
    }
  }
}

run().then(() => process.exit(0));
