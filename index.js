import * as cheerio from 'cheerio';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/** 
 * 1. THE TRUTH TABLE (Updated based on image_10.png and image_12.png)
 * We have bumped Surging Sparks and Destined Rivals to reflect real eBay floors.
 */
const MARKET_DATA = {
  "151": { box: 180, bundle: 55, etb: 70, upc: 135, strategy: "Long Term 💎" },
  "evolving skies": { box: 800, etb: 180, strategy: "Long Term 💎" },
  "prismatic evolutions": { box: 220, etb: 95, bundle: 45, strategy: "Medium Term 📈" },
  "surging sparks": { box: 155, etb: 55, bundle: 60, strategy: "Short Term ⏱️" }, // Corrected to £60
  "destined rivals": { box: 150, etb: 75, bundle: 65, strategy: "Medium Term 📈" }, // Corrected to £65
  "team rocket": { box: 185, etb: 90, bundle: 55, strategy: "Long Term 💎" }
};

const RRP_MAP = { box: 144.99, etb: 49.99, bundle: 24.99, upc: 119.99, tin: 24.99 };

function getAnalysis(title, price) {
  const t = title.toLowerCase();
  
  let type = null;
  if (t.includes("booster box") || t.includes("display box")) type = "box";
  else if (t.includes("etb") || t.includes("trainer box")) type = "etb";
  else if (t.includes("bundle")) type = "bundle";
  else if (t.includes("upc") || t.includes("ultra premium")) type = "upc";
  
  if (!type) return null;

  const rrp = RRP_MAP[type];
  let resell = rrp; 
  let strategy = "Quick Flip ⚠️";
  let matchedSet = "None";

  for (const [set, data] of Object.entries(MARKET_DATA)) {
    if (t.includes(set)) {
      resell = data[type] || rrp;
      strategy = data.strategy;
      matchedSet = set;
      break;
    }
  }

  // Use the eBay fee + shipping math: (Market * 0.87) - Buy - £4
  const netReturn = (resell * 0.87);
  const flip = (netReturn - price - 4).toFixed(2);
  const margin = (((netReturn - 4) / price) - 1) * 100;

  // We only care if profit is positive after all costs
  const isDeal = parseFloat(flip) > 0;

  return { rrp, resell, flip, strategy, isDeal, margin: margin.toFixed(1), matchedSet };
}

async function fetchPage(url) {
  try {
    const res = await fetch(url, { 
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" } 
    });
    return res.ok ? await res.text() : null;
  } catch { return null; }
}

function extract(html, base) {
  const $ = cheerio.load(html);
  const items = [];
  $(".product-item, .product-card, .grid__item, .card-wrapper, .product-block, .product, .item, .product-grid-item").each((_, el) => {
    const title = $(el).find("h2, h3, h4, .product-title, .title, .name").first().text().trim();
    const price = parseFloat($(el).find("[class*='price'], .amount, .money").first().text().replace(/[^0-9.]/g, ""));
    const link = $(el).find("a[href]").first().attr("href");
    
    if (title && price > 15 && link && !$(el).text().toLowerCase().includes("sold out")) {
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

const QUERIES = ["pokemon+booster+box", "pokemon+etb", "pokemon+bundle"];

async function run() {
  const notified = new Set();
  for (const base of RETAILERS) {
    for (const q of QUERIES) {
      const html = await fetchPage(`${base}/search?q=${q}`);
      if (!html) continue;

      const items = extract(html, base);
      for (const item of items) {
        const analysis = getAnalysis(item.title, item.price);
        if (analysis && !notified.has(item.url)) {
          notified.add(item.url);
          
          // Debugging log to confirm 100% accurate set matching
          console.log(`Matched: ${analysis.matchedSet} | Market: £${analysis.resell}`);

          const status = analysis.isDeal ? "✅ **PROFITABLE**" : "❌ OVERPRICED";
          const shop = base.replace('https://', '').replace('www.', '');
          
          const msg = `${status}\n\n<b>${item.title}</b>\n🏪 ${shop}\n\n💰 **BUY:** £${item.price.toFixed(2)}\n📈 **MARKET:** £${analysis.resell.toFixed(2)}\n🏷️ **EST. FLIP:** £${analysis.flip}\n📊 **MARGIN:** ${analysis.margin}%\n⏳ **STRATEGY:** ${analysis.strategy}\n\n👉 <a href="${item.url}">VIEW PRODUCT →</a>`;

          await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { 
            method: "POST", headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML" }) 
          });
        }
      }
      await wait(1500);
    }
  }
}

run().then(() => process.exit(0));
