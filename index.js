import * as cheerio from 'cheerio';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 2026 MASTER MARKET DATA
const MARKET_DATA = {
  "chaos rising": { pack: 5.50, bundle: 30.00, etb: 54.99, box: 154.99 },
  "ascended heroes": { pack: 5.99, bundle: 32.00, etb: 59.99, box: 159.99 },
  "destined rivals": { pack: 4.99, bundle: 28.00, etb: 49.99, box: 144.99 },
  "151": { pack: 8.99, bundle: 45.00, etb: 115.00, upc: 185.00 },
  "prismatic": { pack: 6.50, bundle: 35.00, etb: 65.00 },
  "evolving skies": { box: 2400.00, etb: 550.00 }
};

const RETAILERS = [
  "https://www.magicmadhouse.co.uk", "https://www.chaoscards.co.uk", "https://thecardvault.co.uk",
  "https://www.totalcards.net", "https://japan2uk.com", "https://www.zatu.co.uk",
  "https://www.gatheringgames.co.uk", "https://titancards.co.uk", "https://www.theothergames.co.uk",
  "https://www.thebrotherhoodgames.co.uk", "https://www.cosmiccollectables.co.uk",
  "https://pixel-hub.co.uk", "https://www.koolthings.co.uk", "https://venovacollects.com",
  "https://akeycollects.com", "https://www.hobbystore.co.uk"
];

function getAnalysis(title, price) {
  const t = title.toLowerCase();
  
  // 1. HARD EXCLUSIONS - Kill the "Bags" and "Plush" pings
  const junk = ["bag", "plush", "shirt", "hat", "playmat", "sleeve", "binder", "folder", "coin", "die", "socks", "poster"];
  if (junk.some(word => t.includes(word) && !t.includes("collection"))) return null;

  // 2. STRICT TYPE FILTER
  let type = null;
  if (t.includes("booster box") || t.includes("display box")) type = "box";
  else if (t.includes("etb") || t.includes("elite trainer box")) type = "etb";
  else if (t.includes("booster bundle")) type = "bundle";
  else if (t.includes("booster pack") || t.includes("sleeved booster")) type = "pack";
  else if (t.includes("tin")) type = "tin";

  if (!type) return null;

  // 3. SET DETECTION
  let setKey = Object.keys(MARKET_DATA).find(set => t.includes(set));
  
  // 4. PROFIT & DEAL LOGIC
  const market = setKey ? MARKET_DATA[setKey][type] : (price * 1.2); 
  const profit = ((market * 0.86) - price).toFixed(2);

  // Trigger if it's a specific 2026 priority set OR has high profit
  const isPriority = t.match(/151|chaos|ascended|destined|prismatic/i);
  const isDeal = isPriority || parseFloat(profit) > 5.00;

  return isDeal ? { type, market, profit } : null;
}

async function run() {
  console.log("🛠️ RUNNING TCG-ONLY SCRAPER...");
  const seen = new Set();

  for (const base of RETAILERS) {
    try {
      // Use the 'newest' sort to find restocks immediately
      const url = `${base}/search?q=pokemon+tcg&sort_by=created-descending`;
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0" } });
      if (!res.ok) continue;

      const $ = cheerio.load(await res.text());
      const items = $(".product-card, .product-item, .product, .grid-item, .product-item-info").toArray();

      for (const el of items) {
        const title = $(el).find("h2, h3, .title, .name, .product-title").first().text().trim();
        const price = parseFloat($(el).find(".price, .money, .amount").first().text().replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").attr("href");
        const oos = $(el).text().toLowerCase().match(/out of stock|sold out|unavailable/);

        if (title && price > 3 && link && !oos && !seen.has(link)) {
          const analysis = getAnalysis(title, price);
          if (analysis) {
            seen.add(link);
            const fullLink = link.startsWith("http") ? link : `${new URL(base).origin}${link.startsWith('/') ? '' : '/'}${link}`;
            
            const msg = `🃏 **TCG STOCK ALERT**\n📦 ${analysis.type.toUpperCase()}\n\n<b>${title}</b>\n🏪 ${new URL(base).hostname}\n\n💰 **PRICE:** £${price.toFixed(2)}\n💸 **EST. PROFIT:** £${analysis.profit}\n\n👉 <a href="${fullLink}">BUY NOW →</a>`;

            await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML" })
            });
            await wait(1000);
          }
        }
      }
    } catch (e) { console.log(`Skipping ${base}`); }
    await wait(2500);
  }
}

run().then(() => process.exit(0));
