import * as cheerio from 'cheerio';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const MARKET_DATA = {
  "151": { box: 185, bundle: 60, etb: 75, upc: 140, strategy: "Long Term 💎" },
  "evolving skies": { box: 820, etb: 195, strategy: "Long Term 💎" },
  "prismatic evolutions": { box: 225, etb: 98, bundle: 48, strategy: "Medium Term 📈" },
  "surging sparks": { box: 158, etb: 58, bundle: 60, strategy: "Short Term ⏱️" },
  "ascended heroes": { box: 185, etb: 85, bundle: 55, strategy: "Medium Term 📈" },
  "destined rivals": { box: 155, etb: 78, bundle: 68, strategy: "Medium Term 📈" },
  "silver tempest": { box: 165, etb: 55, bundle: 38, strategy: "Long Term 💎" },
  "lost origin": { box: 195, etb: 65, bundle: 45, strategy: "Long Term 💎" }
};

const RRP_MAP = { box: 144.99, etb: 49.99, bundle: 24.99, upc: 119.99 };

function getAnalysis(title, price) {
  const t = title.toLowerCase();
  
  // 1. Identify Product Type
  let type = null;
  if (t.includes("booster box") || t.includes("display box")) type = "box";
  else if (t.includes("etb") || t.includes("trainer box")) type = "etb";
  else if (t.includes("bundle")) type = "bundle";
  else if (t.includes("upc") || t.includes("ultra premium")) type = "upc";
  
  if (!type) return null;

  // 2. Identify Set match
  let setKey = null;
  for (const set in MARKET_DATA) {
    if (t.includes(set)) { setKey = set; break; }
  }
  if (!setKey || !MARKET_DATA[setKey][type]) return null;

  // 3. CASE LOGIC: Detect if this is a bulk purchase
  let quantity = 1;
  const isCase = t.includes("case") || t.includes("sealed case");
  
  if (isCase) {
    // Try to extract number from "(25)" or "case of 10"
    const qtyMatch = t.match(/\((\d+)\)/) || t.match(/case of (\d+)/) || t.match(/(\d+)\s*x/);
    if (qtyMatch) {
      quantity = parseInt(qtyMatch[1]);
    } else {
      // Fallback to standard industry case sizes
      if (type === "box") quantity = 6;
      if (type === "etb") quantity = 10;
      if (type === "bundle") quantity = 25;
      if (type === "upc") quantity = 4;
    }
  }

  // 4. Calculate Total Market Value
  const unitMarket = MARKET_DATA[setKey][type];
  const totalMarket = unitMarket * quantity;
  const totalRRP = (RRP_MAP[type] || unitMarket) * quantity;

  // Fees: 13% eBay + Shipping (£4 for singles, £15 for heavy cases)
  const shippingCost = isCase ? 15 : 4;
  const netReturn = (totalMarket * 0.87);
  const flip = (netReturn - price - shippingCost).toFixed(2);
  const margin = (((netReturn - shippingCost) / price) - 1) * 100;

  return { 
    isCase,
    quantity,
    rrp: totalRRP, 
    resell: totalMarket, 
    flip, 
    strategy: MARKET_DATA[setKey].strategy, 
    isDeal: parseFloat(flip) > 5.00,
    margin: margin.toFixed(1) 
  };
}

async function fetchPage(url) {
  try {
    const res = await fetch(url, { 
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" } 
    });
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
    
    const innerText = element.text().toLowerCase();
    const outOfStock = innerText.includes("sold out") || innerText.includes("out of stock") || element.find(".sold-out, .out-of-stock").length > 0;

    if (title && price > 15 && link && !outOfStock) {
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

async function run() {
  const notified = new Set();
  for (const base of RETAILERS) {
    for (const q of ["pokemon+case", "pokemon+booster+box", "pokemon+etb", "pokemon+bundle"]) {
      const html = await fetchPage(`${base}/search?q=${q}`);
      if (!html) continue;

      const items = extract(html, base);
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
      await wait(1000);
    }
  }
}

run().then(() => process.exit(0));
