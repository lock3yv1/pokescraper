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
  if (EXCLUDE.some(k => t.includes(k))) return null;
  if (!PRODUCT_KEYWORDS.some(k => t.includes(k))) return null;

  let rrpVal = null;
  for (const [key, val] of Object.entries(RRP)) {
    if (t.includes(key)) { rrpVal = val; break; }
  }
  if (!rrpVal) return null;

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
  const agents = [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
  ];

  try {
    const res = await fetch(url, { 
      headers: { 
        "User-Agent": agents[Math.floor(Math.random() * agents.length)],
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.5",
        "DNT": "1",
        "Upgrade-Insecure-Requests": "1"
      } 
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
    
    if (title && price > 12 && link && !$(el).text().toLowerCase().includes("sold out")) {
      const url = link.startsWith("http") ? link : `${new URL(base).origin}${link.startsWith('/') ? '' : '/'}${link}`;
      items.push({ title, price, url });
    }
  });
  return items;
}

const RETAILERS = [
  { name: "Miniso", url: "https://minisouk.com/collections/pokemon" },
  { name: "Japan2UK", url: "https://japan2uk.com/collections/pokemon-english" },
  { name: "The Card Vault", url: "https://thecardvault.co.uk/collections/pokemon-sealed-product" },
  { name: "Double Sleeved", url: "https://doublesleeved.co.uk/collections/pokemon" },
  { name: "Total Cards", url: "https://www.totalcards.net/pokemon/sealed-product" },
  { name: "My TCG", url: "https://mytcg.co.uk/collections/pokemon-sealed-product" }
];

async function run() {
  console.log(`🚀 STEALTH SCAN: ${new Date().toLocaleTimeString()}`);
  const notified = new Set();
  for (const shop of RETAILERS) {
    console.log(`Checking ${shop.name}...`);
    const html = await fetchPage(shop.url);
    if (!html) { console.log(`  ⚠️ Still Blocked`); continue; }

    const items = extract(html, shop.url);
    for (const item of items) {
      const analysis = getAnalysis(item.title, item.price);
      if (analysis && !notified.has(item.url)) {
        notified.add(item.url);
        const score = analysis.diff <= 5 ? "🔥 DEAL" : "❌ OVERPRICED";
        const msg = `${score}\n\n<b>${item.title}</b>\n🏪 ${shop.name}\n💰 BUY: £${item.price.toFixed(2)}\n📊 RRP: £${analysis.rrp.toFixed(2)} (${analysis.diff > 0 ? "+" : ""}${analysis.diff}%)\n📈 RESELL: £${analysis.resell.toFixed(2)}\n🏷️ FLIP: £${analysis.flip}\n\n👉 <a href="${item.url}">BUY NOW →</a>`;

        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { 
          method: "POST", headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML" }) 
        });
      }
    }
    await wait(3000); // Longer wait to prevent IP flags
  }
}

run().then(() => process.exit(0));
