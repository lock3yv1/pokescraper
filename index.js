import * as cheerio from 'cheerio';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 2026 MARKET TRUTH TABLE - Any item containing these keys will be analyzed
const MARKET_DATA = {
  "ascended heroes": { pack: 5.99, bundle: 32.00, etb: 54.99, box: 155.00 },
  "destined rivals": { pack: 4.50, bundle: 28.00, etb: 49.99, box: 144.99 },
  "chaos rising": { pack: 5.75, bundle: 35.00, etb: 55.00, box: 155.00 },
  "151": { pack: 8.50, bundle: 85.00, etb: 115.00, upc: 185.00 },
  "prismatic": { pack: 6.50, bundle: 68.00, etb: 110.00 },
  "surging sparks": { pack: 4.50, bundle: 32.00, etb: 55.00 },
  "evolving skies": { box: 2400.00, etb: 550.00, pack: 65.00 }
};

const RETAILERS = [
  "https://www.magicmadhouse.co.uk", "https://www.chaoscards.co.uk", "https://thecardvault.co.uk",
  "https://www.totalcards.net", "https://japan2uk.com", "https://www.zatu.co.uk",
  "https://www.gatheringgames.co.uk", "https://titancards.co.uk", "https://www.theothergames.co.uk",
  "https://www.thebrotherhoodgames.co.uk", "https://www.cosmiccollectables.co.uk", "https://www.geek-retreat.uk",
  "https://pixel-hub.co.uk", "https://www.koolthings.co.uk", "https://venovacollects.com",
  "https://akeycollects.com", "https://www.hobbystore.co.uk", "https://www.double-sleeved.com"
];

function getAnalysis(title, price) {
  const t = title.toLowerCase();
  
  // 1. DYNAMIC TYPE IDENTIFICATION (Packs, Tins, Boxes, Bundles)
  let type = null;
  if (t.includes("booster box") || t.includes("display")) type = "box";
  else if (t.includes("etb") || t.includes("elite trainer")) type = "etb";
  else if (t.includes("bundle")) type = "bundle";
  else if (t.includes("pack") || t.includes("sleeved")) type = "pack";
  else if (t.includes("tin")) type = "tin"; // Catches Mini Tins & Standard Tins

  if (!type) return null;

  // 2. EXPANSION IDENTIFICATION (Any expansion in our list)
  let setKey = Object.keys(MARKET_DATA).find(set => t.includes(set));
  
  // 3. PROFIT MATH
  // If set is unknown, we use a 15% margin over RRP as a "deal" trigger
  const marketValue = setKey ? MARKET_DATA[setKey][type] : (price * 1.25);
  if (!marketValue) return null;

  const fees = 0.86; // 14% for platforms/shipping
  const profit = (marketValue * fees - price).toFixed(2);

  // TRIGGER: Ping if it's a priority set (151/New 2026 sets) or if profit > £3
  const isPriority = t.match(/151|chaos|ascended|destined|prismatic|evolving/i);
  const isDeal = isPriority || parseFloat(profit) > 3.00;

  return { type, market: marketValue, profit, isDeal };
}

async function run() {
  console.log(`🚀 TOTAL MARKET SCAN: Monitoring ${RETAILERS.length} Retailers for ALL Expansions...`);
  const notified = new Set();

  for (const base of RETAILERS) {
    try {
      // Searching for the broad term "Pokemon" catches ALL new listings, pre-orders, and restocks
      console.log(`🔎 Auditing ${base.split('.')[1]} for new stock...`);
      
      const res = await fetch(`${base}/search?q=pokemon&sort_by=created-descending`, { 
        headers: { 
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0",
          "Accept": "text/html"
        } 
      });

      if (!res.ok) continue;
      const $ = cheerio.load(await res.text());
      const items = $(".product-card, .product-item, .product, .grid-item, .m-product-card, .product-item-info").toArray();

      for (const el of items) {
        const title = $(el).find("h2, h3, .title, .name, .product-title").first().text().trim();
        const priceRaw = $(el).find(".price, .money, .amount").first().text().replace(/[^0-9.]/g, "");
        const price = parseFloat(priceRaw);
        const link = $(el).find("a").attr("href");
        const oos = $(el).text().toLowerCase().match(/out of stock|sold out|unavailable/);

        if (title && price > 1 && link && !oos && !notified.has(link)) {
          const analysis = getAnalysis(title, price);
          
          if (analysis && analysis.isDeal) {
            notified.add(link);
            const fullLink = link.startsWith("http") ? link : `${new URL(base).origin}${link.startsWith('/') ? '' : '/'}${link}`;
            
            const msg = `👑 **ALL-EXPANSION ALERT**\n📦 ${analysis.type.toUpperCase()}\n\n<b>${title}</b>\n🏪 ${new URL(base).hostname}\n\n💰 **BUY:** £${price.toFixed(2)}\n📈 **EST. MARKET:** £${analysis.market.toFixed(2)}\n💸 **EST. PROFIT:** £${analysis.profit}\n\n👉 <a href="${fullLink}">BUY NOW →</a>`;

            await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML" })
            });
            await wait(1000);
          }
        }
      }
    } catch (e) { console.log(`[!] Retailer ${base.split('.')[1]} is currently busy.`); }
    await wait(3000); // Respectful crawl delay
  }
}

run().then(() => process.exit(0));
