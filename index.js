import * as cheerio from 'cheerio';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 1. THE GOLD STANDARD DATA (Updated & Tightened)
const MARKET_DATA = {
  "151": { box: 185, bundle: 60, etb: 75, upc: 140, strategy: "Long Term 💎" },
  "evolving skies": { box: 820, etb: 195, strategy: "Long Term 💎" },
  "prismatic evolutions": { box: 225, etb: 98, bundle: 48, strategy: "Medium Term 📈" },
  "surging sparks": { box: 158, etb: 58, bundle: 60, strategy: "Short Term ⏱️" },
  "ascended heroes": { box: 175, etb: 85, bundle: 55, strategy: "Medium Term 📈" },
  "destined rivals": { box: 155, etb: 78, bundle: 68, strategy: "Medium Term 📈" },
  "silver tempest": { box: 165, etb: 55, bundle: 38, strategy: "Long Term 💎" },
  "lost origin": { box: 195, etb: 65, bundle: 45, strategy: "Long Term 💎" },
  "violet ex": { box: 75, strategy: "Japanese - Quick Flip ⚠️" } 
};

const RRP_MAP = { box: 144.99, etb: 49.99, bundle: 24.99, upc: 119.99 };

function getAnalysis(title, price) {
  const t = title.toLowerCase();
  
  // Identify Product Type
  let type = null;
  if (t.includes("booster box") || t.includes("display box")) type = "box";
  else if (t.includes("etb") || t.includes("trainer box")) type = "etb";
  else if (t.includes("bundle")) type = "bundle";
  else if (t.includes("upc") || t.includes("ultra premium")) type = "upc";
  
  if (!type) return null;

  // Check if we have verified data for this specific set
  let setInfo = null;
  for (const [setName, data] of Object.entries(MARKET_DATA)) {
    if (t.includes(setName)) {
      if (data[type]) {
        setInfo = { resell: data[type], strategy: data.strategy, rrp: RRP_MAP[type] || data[type] };
        break;
      }
    }
  }

  // If set is unknown, we SKIP to maintain 100% accuracy
  if (!setInfo) return null;

  const netReturn = (setInfo.resell * 0.87);
  const flip = (netReturn - price - 4).toFixed(2);
  const margin = (((netReturn - 4) / price) - 1) * 100;

  // We ONLY ping if it's actually profitable
  return { 
    rrp: setInfo.rrp, 
    resell: setInfo.resell, 
    flip, 
    strategy: setInfo.strategy, 
    isDeal: parseFloat(flip) > 1.00, // Profit floor of £1
    margin: margin.toFixed(1) 
  };
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
    const element = $(el);
    const title = element.find("h2, h3, h4, .product-title, .title, .name").first().text().trim();
    const price = parseFloat(element.find("[class*='price'], .amount, .money").first().text().replace(/[^0-9.]/g, ""));
    const link = element.find("a[href]").first().attr("href");
    
    const innerText = element.text().toLowerCase();
    const outOfStock = innerText.includes("sold out") || innerText.includes("out of stock") || innerText.includes("unavailable") || element.find(".sold-out, .out-of-stock").length > 0;

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
  console.log(`🚀 STARTING SCRAPE: ${new Date().toLocaleTimeString()}`);
  const notified = new Set();

  for (const base of RETAILERS) {
    console.log(`🔎 Checking: ${base}...`);
    let shopCount = 0;

    for (const q of ["pokemon+booster+box", "pokemon+etb", "pokemon+bundle"]) {
      const html = await fetchPage(`${base}/search?q=${q}`);
      if (!html) { console.log(`  ⚠️ Blocked by ${base}`); break; }

      const items = extract(html, base);
      for (const item of items) {
        const analysis = getAnalysis(item.title, item.price);
        if (analysis && analysis.isDeal && !notified.has(item.url)) {
          notified.add(item.url);
          shopCount++;
          
          const shopName = base.replace('https://', '').replace('www.', '');
          const msg = `✅ **PROFITABLE DEAL**\n\n<b>${item.title}</b>\n🏪 ${shopName}\n\n💰 **BUY:** £${item.price.toFixed(2)}\n📈 **MARKET:** £${analysis.resell.toFixed(2)}\n🏷️ **EST. FLIP:** £${analysis.flip}\n📊 **MARGIN:** ${analysis.margin}%\n⏳ **STRATEGY:** ${analysis.strategy}\n\n👉 <a href="${item.url}">VIEW PRODUCT →</a>`;

          await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { 
            method: "POST", headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML" }) 
          });
        }
      }
      await wait(1000);
    }
    console.log(`  ✅ Finished ${base}. Found ${shopCount} profitable deals.`);
  }
  console.log("🏁 ALL SHOPS SCANNED.");
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
