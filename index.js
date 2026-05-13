import * as cheerio from 'cheerio';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 1. UPDATED TRUTH TABLE (More sets = More Pings)
const MARKET_DATA = {
  "151": { box: 185, bundle: 65, etb: 80, upc: 145, collection: 35, strategy: "Long Term 💎" },
  "evolving skies": { box: 850, etb: 200, strategy: "Long Term 💎" },
  "prismatic evolutions": { box: 230, etb: 105, bundle: 50, strategy: "Medium Term 📈" },
  "surging sparks": { box: 160, etb: 60, bundle: 62, strategy: "Short Term ⏱️" },
  "ascended heroes": { box: 185, etb: 85, bundle: 55, strategy: "Medium Term 📈" },
  "destined rivals": { box: 160, etb: 80, bundle: 70, strategy: "Medium Term 📈" },
  "silver tempest": { box: 170, etb: 55, bundle: 40, strategy: "Long Term 💎" },
  "lost origin": { box: 200, etb: 70, bundle: 45, strategy: "Long Term 💎" },
  "crown zenith": { box: 160, etb: 65, sea: 65, strategy: "Long Term 💎" },
  "violet ex": { box: 75, strategy: "Japanese - Quick Flip ⚠️" }
};

const RRP_MAP = { box: 144.99, etb: 49.99, bundle: 24.99, upc: 119.99, collection: 29.99 };

function getAnalysis(title, price) {
  const t = title.toLowerCase();
  
  let type = null;
  if (t.includes("booster box") || t.includes("display box")) type = "box";
  else if (t.includes("etb") || t.includes("trainer box")) type = "etb";
  else if (t.includes("bundle")) type = "bundle";
  else if (t.includes("upc") || t.includes("ultra premium")) type = "upc";
  else if (t.includes("collection") || t.includes("poster")) type = "collection";
  
  if (!type) return null;

  let setKey = null;
  for (const set in MARKET_DATA) {
    if (t.includes(set)) { setKey = set; break; }
  }
  if (!setKey || !MARKET_DATA[setKey][type]) return null;

  // Case/Quantity Detection (Fixed from image_16.png)
  let quantity = 1;
  const isCase = t.includes("case") || t.includes("sealed case");
  if (isCase) {
    const qtyMatch = t.match(/\((\d+)\)/) || t.match(/case of (\d+)/) || t.match(/(\d+)\s*x/);
    quantity = qtyMatch ? parseInt(qtyMatch[1]) : (type === "box" ? 6 : type === "etb" ? 10 : type === "bundle" ? 25 : 1);
  }

  const unitMarket = MARKET_DATA[setKey][type];
  const totalMarket = unitMarket * quantity;
  const shipping = isCase ? 15 : 4;
  const netReturn = (totalMarket * 0.87);
  const flip = (netReturn - price - shipping).toFixed(2);
  const margin = (((netReturn - shipping) / price) - 1) * 100;

  return { isCase, quantity, resell: totalMarket, flip, strategy: MARKET_DATA[setKey].strategy, isDeal: parseFloat(flip) > 2.00, margin: margin.toFixed(1) };
}

async function fetchPage(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } });
    return res.ok ? await res.text() : null;
  } catch { return null; }
}

function extract(html, base) {
  const $ = cheerio.load(html);
  const items = [];
  $(".product-item, .product-card, .grid__item, .card-wrapper, .product-block, .product, .item").each((_, el) => {
    const element = $(el);
    const title = element.find("h2, h3, h4, .product-title, .title, .name").first().text().trim();
    const price = parseFloat(element.find("[class*='price'], .amount, .money").first().text().replace(/[^0-9.]/g, ""));
    const link = element.find("a[href]").first().attr("href");
    const outOfStock = element.text().toLowerCase().includes("sold out") || element.text().toLowerCase().includes("out of stock") || element.find(".sold-out, .out-of-stock").length > 0;

    if (title && price > 10 && link && !outOfStock) {
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

const SEARCH_QUERIES = ["pokemon+case", "pokemon+booster+box", "pokemon+etb", "pokemon+bundle", "pokemon+151"];

async function run() {
  console.log("🚀 STARTING DEEP SCAN...");
  const notified = new Set();

  for (const base of RETAILERS) {
    for (const q of SEARCH_QUERIES) {
      // SCAN PAGES 1, 2, and 3
      for (let page = 1; page <= 3; page++) {
        const url = `${base}/search?q=${q}&page=${page}`;
        const html = await fetchPage(url);
        if (!html) break;

        const items = extract(html, base);
        if (items.length === 0) break; // Stop if page is empty

        for (const item of items) {
          const analysis = getAnalysis(item.title, item.price);
          if (analysis && !notified.has(item.url)) {
            notified.add(item.url);
            
            const label = analysis.isCase ? `📦 CASE OF ${analysis.quantity}` : `🃏 SINGLE ITEM`;
            const status = analysis.isDeal ? "✅ **PROFITABLE**" : "❌ NOT PROFITABLE";
            const shop = base.replace('https://', '').replace('www.', '');
            
            const msg = `${status} (${label})\n\n<b>${item.title}</b>\n🏪 ${shop}\n\n💰 **BUY:** £${item.price.toFixed(2)}\n📈 **MARKET:** £${analysis.resell.toFixed(2)}\n🏷️ **EST. FLIP:** £${analysis.flip}\n📊 **MARGIN:** ${analysis.margin}%\n⏳ **STRATEGY:** ${analysis.strategy}\n\n👉 <a href="${item.url}">VIEW PRODUCT →</a>`;

            await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { 
              method: "POST", headers: { "Content-Type": "application/json" }, 
              body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML" }) 
            });
          }
        }
        await wait(1200);
      }
    }
  }
}

run().then(() => process.exit(0));
